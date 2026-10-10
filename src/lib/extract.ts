import { env } from "./config";
import type { Facts } from "./types";

export const EMPTY_FACTS: Facts = {
  intent: "other",
  propertyType: "unknown",
  location: null,
  inServiceArea: "unknown",
  areaSqft: null,
  scope: null,
  weeksAvailable: null,
  budgetLakh: null,
  decisionMaker: "unknown",
  priceAsked: false,
  callerName: null,
  referral: null,
};

const IN_AREA = [
  "pune", "kothrud", "baner", "aundh", "wakad", "koregaon park", "kalyani nagar", "viman nagar", "hadapsar",
  "magarpatta", "nibm", "kondhwa", "undri", "shivane", "warje", "erandwane", "deccan", "pimpri", "chinchwad",
  "pimple saudagar", "pimple nilakh", "ravet", "hinjewadi", "kharadi", "nanded", "pcmc",
];
const OUT_AREA = ["talegaon", "lonavala", "nashik", "mumbai", "nagpur", "bangalore", "bengaluru", "delhi", "hyderabad", "satara", "kolhapur"];

export interface ExtractResult {
  facts: Facts;
  source: "gemini" | "heuristic";
  costUsd: number;
}

/** Gemini Flash extracts facts as JSON; falls back to a heuristic on any failure. */
export async function extractFacts(transcript: string, callDate: Date): Promise<ExtractResult> {
  const key = env("GEMINI_API_KEY");
  if (key) {
    try {
      return await geminiExtract(transcript, callDate, key);
    } catch (e) {
      console.error("gemini_extract_failed", (e as Error).message);
    }
  }
  return { facts: heuristicExtract(transcript, callDate), source: "heuristic", costUsd: 0 };
}

const SCHEMA_PROMPT = `You extract facts from a phone-call transcript for an interior design studio in Pune.
Return ONLY JSON with keys:
intent: "project"|"advice_only"|"price_only"|"complaint"|"other"  (complaint = existing customer chasing/complaining)
propertyType: "residential"|"office"|"hospitality_retail_gym"|"unknown"
location: string|null; inServiceArea: "yes"|"no"|"unknown" (Pune city/PCMC = yes; Talegaon, Nashik, Mumbai, Lonavala = no)
areaSqft: number|null; scope: short string|null
weeksAvailable: number|null  (weeks between the call date and when the caller needs the work complete; null if not stated)
budgetLakh: number|null (UPPER end of a budget the CALLER volunteered, in lakh; null if none)
decisionMaker: "yes"|"represented"|"no"|"unknown" (represented = calling for someone who authorised them)
priceAsked: boolean; callerName: string|null; referral: string|null
Do not infer anything the caller did not say.`;

async function geminiExtract(transcript: string, callDate: Date, key: string): Promise<ExtractResult> {
  const model = env("GEMINI_MODEL") ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${SCHEMA_PROMPT}\n\nCall date: ${callDate.toISOString().slice(0, 10)}\n\nTRANSCRIPT:\n${transcript}` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
    if (!res.ok) throw new Error(`gemini http ${res.status}`);
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const facts = coerceFacts(JSON.parse(text));
    const u = json.usageMetadata ?? {};
    // Gemini 2.5 Flash list price: $0.30 / 1M input, $2.50 / 1M output tokens
    const costUsd = ((u.promptTokenCount ?? 0) * 0.3 + (u.candidatesTokenCount ?? 0) * 2.5) / 1e6;
    return { facts, source: "gemini", costUsd };
  } finally {
    clearTimeout(t);
  }
}

/** Validate LLM output: never trust shape. */
export function coerceFacts(raw: unknown): Facts {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : d;
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
  return {
    intent: pick(o.intent, ["project", "advice_only", "price_only", "complaint", "other"] as const, "other"),
    propertyType: pick(o.propertyType, ["residential", "office", "hospitality_retail_gym", "unknown"] as const, "unknown"),
    location: str(o.location),
    inServiceArea: pick(o.inServiceArea, ["yes", "no", "unknown"] as const, "unknown"),
    areaSqft: num(o.areaSqft),
    scope: str(o.scope),
    weeksAvailable: num(o.weeksAvailable),
    budgetLakh: num(o.budgetLakh),
    decisionMaker: pick(o.decisionMaker, ["yes", "represented", "no", "unknown"] as const, "unknown"),
    priceAsked: o.priceAsked === true,
    callerName: str(o.callerName),
    referral: str(o.referral),
  };
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Offline fallback. Conservative: leaves fields null/unknown rather than guessing. */
export function heuristicExtract(transcript: string, callDate: Date): Facts {
  const caller = transcript
    .split(/\r?\n/)
    .filter((l) => /^(caller|user|customer)\s*:/i.test(l.trim()))
    .map((l) => l.replace(/^[^:]+:\s*/, ""))
    .join(" ");
  const lc = caller.toLowerCase();
  const f: Facts = { ...EMPTY_FACTS };

  if (/\b(not acceptable|hasn'?t replied|haven'?t replied|no one replied|not replied|still waiting|my designer)\b/.test(lc)) f.intent = "complaint";
  else if (/\b(just (looking for )?(ideas|suggestions|advice)|suggestions on|only (want )?advice|just exploring)\b/.test(lc)) f.intent = "advice_only";
  else if (/\b(redesign|redo|interiors?|design|fit-?out|fitout|kitchen|wardrobe|bedroom|living room|office)\b/.test(lc)) f.intent = "project";
  else if (/\b(cost|price|rate|how much)\b/.test(lc)) f.intent = "price_only";
  f.priceAsked = /\b(cost|price|pricing|rate|how much|ballpark|per sq)\b/.test(lc);

  if (/\b(restaurant|hotel|cafe|gym|retail|showroom|boutique)\b/.test(lc)) f.propertyType = "hospitality_retail_gym";
  else if (/\b(office|clinic|studio|workstations?|coworking)\b/.test(lc)) f.propertyType = "office";
  else if (/\b(flat|apartment|\dbhk|villa|house|home|bungalow|living room|bedroom)\b/.test(lc)) f.propertyType = "residential";

  const out = OUT_AREA.find((p) => lc.includes(p));
  const inn = IN_AREA.find((p) => lc.includes(p));
  if (out) { f.location = out; f.inServiceArea = "no"; }
  else if (inn) { f.location = inn; f.inServiceArea = "yes"; }

  const area = lc.match(/(?:about|around|approximately|~)?\s*([\d,]{3,6})\s*(?:sq\.?\s*ft|sqft|square feet)/);
  if (area) f.areaSqft = parseInt(area[1].replace(/,/g, ""), 10);

  const budget = lc.match(/budget[^.]{0,40}?(\d+(?:\.\d+)?)\s*(?:to|-|–)?\s*(\d+(?:\.\d+)?)?\s*lakh/);
  if (budget) f.budgetLakh = parseFloat(budget[2] ?? budget[1]);

  const wk = lc.match(/(\d+)\s*weeks?/);
  const mo = MONTHS.findIndex((m) => new RegExp(`\\b(by|before|in|from)\\s+${m}\\b`).test(lc));
  if (wk) f.weeksAvailable = parseInt(wk[1], 10);
  else if (mo >= 0) {
    const target = new Date(callDate.getFullYear(), mo, 15);
    if (target < callDate) target.setFullYear(target.getFullYear() + 1);
    f.weeksAvailable = Math.round((target.getTime() - callDate.getTime()) / (7 * 864e5));
  } else if (/\b(no rush|flexible|plenty of time|whenever)\b/.test(lc)) f.weeksAvailable = 26;

  if (/\b(i'?m the (owner|founder|decision)|my husband and i|myself and my|we both|yes[ —-]+(i'?m|myself|my husband))\b|\bowner\b/.test(lc)) f.decisionMaker = "yes";
  else if (/\b(for my (parents|in-laws|father|mother)|initial (checking|research)|doing research)\b/.test(lc)) f.decisionMaker = "no";

  const nm = caller.match(/\b(?:[Ii]'?m|I am|[Tt]his is|[Mm]y name is)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  if (nm) f.callerName = nm[1];
  const ref = caller.match(/(?:got your number from|asked me to call|referred by)\s+([A-Z][\w ]{2,30})/);
  if (ref) f.referral = ref[1].trim();
  return f;
}
