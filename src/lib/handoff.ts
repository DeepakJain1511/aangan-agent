import type { Decision, Facts } from "./types";

const OUTCOME_LABEL = { forward: "NEW QUALIFIED LEAD", decline: "Declined", clarify: "Needs follow-up", escalate: "ESCALATION" } as const;

/**
 * The handoff note: everything the front desk already asked, so the designer's
 * first call does not repeat questions. Never contains a price.
 */
export function buildHandoffNote(opts: {
  facts: Facts;
  decision: Decision;
  phone: string | null;
  bookedSlot: string | null;
}): string {
  const { facts: f, decision: d, phone, bookedSlot } = opts;
  const lines: string[] = [];
  lines.push(`${OUTCOME_LABEL[d.outcome]}: ${f.callerName ?? "Unknown caller"}${phone ? ` (${phone})` : ""}`);
  if (d.outcome === "escalate") {
    lines.push("Existing project complaint. Caller asked for a senior callback within 15 minutes.");
    return lines.join("\n");
  }
  lines.push(`Project: ${[f.propertyType, f.scope].filter((x) => x && x !== "unknown").join(" - ") || "not stated"}`);
  lines.push(`Location: ${f.location ?? "not stated"}${f.areaSqft ? ` | ${f.areaSqft} sq ft carpet` : ""}`);
  lines.push(`Timeline: ${f.weeksAvailable !== null ? `about ${f.weeksAvailable} weeks available` : "not stated"}`);
  lines.push(`Decision-maker: ${f.decisionMaker}`);
  if (f.referral) lines.push(`Referral: ${f.referral}`);
  if (f.priceAsked) lines.push("Asked about price: deflected, no figure given. Designer to cover pricing.");
  if (bookedSlot) lines.push(`Consultation slot: ${bookedSlot}`);
  else if (d.outcome === "forward") lines.push("Consultation: not yet booked. Please call to schedule.");
  for (const n of d.notes) lines.push(`Note: ${n}`);
  if (d.outcome !== "forward") lines.push(`Why: ${d.reason}`);
  return lines.join("\n");
}
