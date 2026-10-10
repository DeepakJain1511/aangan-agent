import { RULES, env } from "./config";
import type { EnquiryRecord } from "./types";

export interface Metrics {
  total: number;
  byOutcome: Record<string, number>;
  afterHoursShare: number;
  avgHandoffSeconds: number | null;
  handoffUnder5MinShare: number | null;
  booked: number;
  pricingViolations: number;
  voiceCostInr: number;
  llmCostInr: number;
  totalCostInr: number;
  costPerCallInr: number | null;
  costPerQualifiedLeadInr: number | null;
  /** Indicative pipeline: forwarded leads x average project value from the brief (not revenue). */
  pipelineLakh: number;
}

const IST_OFFSET_MIN = 330;
export function isAfterHoursIST(iso: string): boolean {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MIN * 60000);
  const h = d.getUTCHours();
  return h < 10 || h >= 19;
}

export function computeMetrics(rows: EnquiryRecord[]): Metrics {
  const fx = Number(env("USD_TO_INR") ?? 88);
  const byOutcome: Record<string, number> = { forward: 0, decline: 0, clarify: 0, escalate: 0 };
  for (const r of rows) byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
  const hand = rows.map((r) => r.handoff_seconds).filter((x): x is number => x !== null);
  const voice = rows.reduce((s, r) => s + r.voice_cost_usd, 0) * fx;
  const llm = rows.reduce((s, r) => s + r.llm_cost_usd, 0) * fx;
  const total = voice + llm;
  const fwd = byOutcome.forward;
  return {
    total: rows.length,
    byOutcome,
    afterHoursShare: rows.length ? rows.filter((r) => isAfterHoursIST(r.started_at)).length / rows.length : 0,
    avgHandoffSeconds: hand.length ? hand.reduce((a, b) => a + b, 0) / hand.length : null,
    handoffUnder5MinShare: hand.length ? hand.filter((s) => s <= 300).length / hand.length : null,
    booked: rows.filter((r) => r.booked_slot).length,
    pricingViolations: rows.filter((r) => r.pricing_violation).length,
    voiceCostInr: voice,
    llmCostInr: llm,
    totalCostInr: total,
    costPerCallInr: rows.length ? total / rows.length : null,
    costPerQualifiedLeadInr: fwd ? total / fwd : null,
    pipelineLakh: fwd * RULES.avgProjectValueLakh,
  };
}
