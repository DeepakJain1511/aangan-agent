/**
 * Live end-to-end test against a running server (local or deployed) and the real services.
 * Sends a fake Vaani call, checks Supabase + Telegram + HubSpot, then deletes its test records.
 * Run: npx tsx --env-file=.env.local scripts/e2e-live.ts http://localhost:3000
 * Prints results only, never secret values.
 */
const base = process.argv[2] ?? "http://localhost:3000";
const env = (k: string) => process.env[k] ?? "";
const callId = `e2e-test-${Date.now()}`;
const room = `room-${callId}`;
const url = `${base}/api/webhooks/vaani?token=${encodeURIComponent(env("VAANI_WEBHOOK_TOKEN"))}`;
const post = (b: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const sb = (p: string, init: RequestInit = {}) =>
  fetch(`${env("SUPABASE_URL")}/rest/v1/${p}`, { ...init, headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`, "content-type": "application/json", ...(init.headers ?? {}) } });
const hs = (p: string, init: RequestInit = {}) =>
  fetch(`https://api.hubapi.com${p}`, { ...init, headers: { authorization: `Bearer ${env("HUBSPOT_TOKEN")}`, "content-type": "application/json" } });

const transcript = [
  "[00:01] AGENT: Good day, Aangan Studio. How can I help you?",
  "[00:04] USER: Hi, I'm ZZ Testcaller. I have a 3BHK in Kothrud, about 1,400 sq ft carpet. We want to redo the whole thing, kitchen, living room and both bedrooms.",
  "[00:20] AGENT: When would you need it complete?",
  "[00:23] USER: By March, no rush.",
  "[00:30] AGENT: Are you the owner?",
  "[00:33] USER: Yes, myself and my husband.",
].join("\n");

async function main() {
  console.log("1 wrong token rejected:", (await fetch(`${base}/api/webhooks/vaani?token=nope`, { method: "POST", body: "{}" })).status === 401);
  console.log("2 call_started:", (await post({ event: "call_started", room_name: room, phone_number: "+910000000001" })).status);
  const body = { event: "call_postprocessing", call_id: callId, timestamp: new Date().toISOString(), data: { room_name: room, call_id: callId, call_duration: 150000, recording_url: null, entities: { meeting_slot: "Mon 12 Oct, 10:00 AM IST" }, transcript } };
  const r = await post(body);
  console.log("3 call_postprocessing:", r.status, JSON.stringify(await r.json()));
  const dup = await post(body);
  console.log("4 duplicate ignored:", (await dup.json() as { duplicate?: boolean }).duplicate === true);

  const rows = (await (await sb(`enquiries?call_id=eq.${callId}&select=*`)).json()) as any[];
  const row = rows[0];
  console.log("5 supabase row:", row ? `outcome=${row.outcome} phone=${row.phone} slot=${row.booked_slot} telegram_msg=${row.telegram_message_id} hubspot_deal=${row.hubspot_deal_id}` : "MISSING");
  if (row?.reason?.includes("integration errors")) console.log("   integration errors:", row.reason.split("[")[1]);
  console.log("   handoff note:\n   " + String(row?.handoff_note).split("\n").join("\n   "));

  // cleanup
  if (row?.telegram_message_id) {
    const t = env("TELEGRAM_BOT_TOKEN"), c = env("TELEGRAM_CHAT_ID");
    for (let i = 0; i < 4; i++) await fetch(`https://api.telegram.org/bot${t}/deleteMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: c, message_id: row.telegram_message_id + i }) });
  }
  if (row?.hubspot_deal_id) await hs(`/crm/v3/objects/deals/${row.hubspot_deal_id}`, { method: "DELETE" });
  if (row?.hubspot_contact_id) await hs(`/crm/v3/objects/contacts/${row.hubspot_contact_id}`, { method: "DELETE" });
  await sb(`enquiries?call_id=eq.${callId}`, { method: "DELETE" });
  await sb(`call_meta?room_name=eq.${room}`, { method: "DELETE" });
  console.log("6 test records cleaned up (Telegram, HubSpot, Supabase)");
}
main().catch((e) => console.log("error:", (e as Error).message));
