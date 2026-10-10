import { env } from "./config";

/** fetch with timeout; integrations must never hang the webhook. */
async function http(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}
const json = { "content-type": "application/json" };

// ---------------------------------------------------------------- Telegram
const tg = (method: string) => `https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/${method}`;
export const telegramConfigured = () => !!(env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_CHAT_ID"));

export async function sendTelegramLead(text: string, callId: string, showClaim: boolean): Promise<number | null> {
  if (!telegramConfigured()) return null;
  const res = await http(tg("sendMessage"), {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      chat_id: env("TELEGRAM_CHAT_ID"),
      text,
      reply_markup: showClaim ? { inline_keyboard: [[{ text: "Claim this lead", callback_data: `claim:${callId}` }]] } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`telegram http ${res.status}`);
  const body = (await res.json()) as { result?: { message_id?: number } };
  return body.result?.message_id ?? null;
}

/** Transcript as a reply under the lead, split under Telegram's 4096-char limit. */
export async function sendTelegramTranscript(transcript: string, replyTo: number | null): Promise<void> {
  if (!telegramConfigured()) return;
  for (const chunk of splitText(transcript, 3900)) {
    await http(tg("sendMessage"), {
      method: "POST",
      headers: json,
      body: JSON.stringify({ chat_id: env("TELEGRAM_CHAT_ID"), text: chunk, reply_to_message_id: replyTo ?? undefined }),
    });
  }
}

export async function editTelegramMessage(messageId: number, text: string): Promise<void> {
  if (!telegramConfigured()) return;
  await http(tg("editMessageText"), {
    method: "POST",
    headers: json,
    body: JSON.stringify({ chat_id: env("TELEGRAM_CHAT_ID"), message_id: messageId, text }),
  });
}

export async function answerCallback(id: string, text: string): Promise<void> {
  if (!env("TELEGRAM_BOT_TOKEN")) return;
  await http(tg("answerCallbackQuery"), { method: "POST", headers: json, body: JSON.stringify({ callback_query_id: id, text }) });
}

export function splitText(s: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of s.split("\n")) {
    if ((cur + "\n" + line).length > max && cur) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? cur + "\n" + line : line;
    while (cur.length > max) {
      out.push(cur.slice(0, max));
      cur = cur.slice(max);
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------------------------------------------------------------- HubSpot
const hs = (p: string) => `https://api.hubapi.com${p}`;
const hsHeaders = () => ({ ...json, authorization: `Bearer ${env("HUBSPOT_TOKEN")}` });

/** Upsert contact by phone (repeat callers share one contact), then create a deal. No price is ever stored. */
export async function syncHubspot(args: {
  name: string | null;
  phone: string | null;
  note: string;
  callId: string;
}): Promise<{ contactId: string | null; dealId: string | null }> {
  if (!env("HUBSPOT_TOKEN")) return { contactId: null, dealId: null };
  let contactId: string | null = null;
  if (args.phone) {
    const s = await http(hs("/crm/v3/objects/contacts/search"), {
      method: "POST",
      headers: hsHeaders(),
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: args.phone }] }], limit: 1 }),
    });
    if (s.ok) contactId = ((await s.json()) as { results?: { id: string }[] }).results?.[0]?.id ?? null;
  }
  if (!contactId) {
    const [first, ...rest] = (args.name ?? "Unknown caller").split(" ");
    const c = await http(hs("/crm/v3/objects/contacts"), {
      method: "POST",
      headers: hsHeaders(),
      body: JSON.stringify({ properties: { firstname: first, lastname: rest.join(" "), phone: args.phone ?? "" } }),
    });
    if (!c.ok) throw new Error(`hubspot contact ${c.status}`);
    contactId = ((await c.json()) as { id: string }).id;
  }
  const d = await http(hs("/crm/v3/objects/deals"), {
    method: "POST",
    headers: hsHeaders(),
    body: JSON.stringify({
      properties: { dealname: `Phone enquiry: ${args.name ?? args.phone ?? args.callId}`, dealstage: "appointmentscheduled", description: args.note },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
    }),
  });
  if (!d.ok) throw new Error(`hubspot deal ${d.status}`);
  return { contactId, dealId: ((await d.json()) as { id: string }).id };
}
