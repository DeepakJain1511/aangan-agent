export type Intent = "project" | "advice_only" | "price_only" | "complaint" | "other";
export type Tri = "yes" | "no" | "unknown";

/** Structured facts extracted from a call transcript. Decisions are never made by the LLM. */
export interface Facts {
  intent: Intent;
  propertyType: "residential" | "office" | "hospitality_retail_gym" | "unknown";
  location: string | null;
  inServiceArea: Tri;
  areaSqft: number | null;
  scope: string | null;
  /** weeks from the call until the project must be complete (null = not stated) */
  weeksAvailable: number | null;
  /** upper end of a budget the caller volunteered, in lakh (null = not mentioned) */
  budgetLakh: number | null;
  decisionMaker: "yes" | "represented" | "no" | "unknown";
  priceAsked: boolean;
  callerName: string | null;
  referral: string | null;
}

export type Outcome = "forward" | "decline" | "clarify" | "escalate";
export type CriterionStatus = "pass" | "fail" | "unclear";

export interface CriterionResult {
  key: "real_project" | "service_area" | "timeline" | "budget" | "decision_maker";
  label: string;
  status: CriterionStatus;
  evidence: string;
}

export interface Decision {
  outcome: Outcome;
  criteria: CriterionResult[];
  reason: string;
  clarifyingQuestion: string | null;
  closingLine: string | null;
  notes: string[];
}

export interface CallInput {
  callId: string;
  phone: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  transcript: string;
  recordingUrl: string | null;
  voiceCostUsd: number | null;
  bookedSlot: string | null;
  roomName?: string;
  entities?: Record<string, unknown> | null;
}

export interface EnquiryRecord {
  call_id: string;
  phone: string | null;
  caller_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  outcome: Outcome;
  reason: string;
  facts: Facts;
  criteria: CriterionResult[];
  handoff_note: string;
  transcript: string;
  recording_url: string | null;
  booked_slot: string | null;
  pricing_violation: boolean;
  voice_cost_usd: number;
  llm_cost_usd: number;
  handoff_seconds: number | null;
  telegram_message_id: number | null;
  claimed_by: string | null;
  hubspot_contact_id: string | null;
  hubspot_deal_id: string | null;
  is_sample: boolean;
  created_at: string;
}
