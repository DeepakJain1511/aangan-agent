import { PRICE_DEFLECTION } from "./config";

/**
 * Detects any quoted number or rate. The agent must never say these (pricing.md).
 * Used as a post-call audit on assistant turns and as a safety net on any text we send.
 */
const PATTERNS: RegExp[] = [
  /(?:₹|\brs\.?|\binr\b|\brupees?\b)\s*[\d,]+/i,
  /[\d,.]+\s*(?:lakhs?|lacs?|crores?|\bcr\b)\b/i,
  /per\s*(?:sq\.?\s*ft|square\s*f(?:oo|ee)t|sqft)/i,
  /(?:sq\.?\s*ft|sqft)\s*(?:rate|price)/i,
  /\bstarts?\s+(?:at|from)\b[^.]{0,30}\d/i,
  /\bit(?:'|’)?ll\s+cost\s+around\b/i,
  /\btypically\s+(?:costs?|runs?)\b/i,
];

export function violatesPricingRule(text: string): boolean {
  return PATTERNS.some((p) => p.test(text));
}

export function guardOutgoing(text: string): string {
  return violatesPricingRule(text) ? PRICE_DEFLECTION : text;
}

/** Audit the assistant lines of a transcript. Caller lines may contain numbers freely. */
export function auditTranscript(transcript: string): { violation: boolean; lines: string[] } {
  const bad = transcript
    .split(/\r?\n/)
    .filter((l) => /^(ai|assistant|agent|bot|front desk)\s*:/i.test(l.trim()))
    .filter((l) => violatesPricingRule(l));
  return { violation: bad.length > 0, lines: bad };
}
