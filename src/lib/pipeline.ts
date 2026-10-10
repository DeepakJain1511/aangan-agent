import { extractFacts } from "./extract";
import { buildHandoffNote } from "./handoff";
import { editTelegramMessage, sendTelegramLead, sendTelegramTranscript, syncHubspot } from "./integrations";
import { auditTranscript } from "./pricing-guard";
import { qualify } from "./qualify";
import { getStore } from "./store";
import type { CallInput, Decision, EnquiryRecord, Facts } from "./types";

/**
 * Trigger: call_postprocessing webhook from Vaani.
 * Idempotent on callId: a re-delivered webhook returns the existing record and sends nothing twice.
 * One integration failing never blocks the others; failures are recorded in `reason` and logged.
 */
export async function processCall(
  input: CallInput,
  opts: { factsOverride?: Facts; isSample?: boolean } = {},
): Promise<{ record: EnquiryRecord; duplicate: boolean }> {
  const store = getStore();
  const existing = await store.get(input.callId);
  if (existing) return { record: existing, duplicate: true };

  const callDate = new Date(input.startedAt);
  let facts: Facts;
  let llmCost = 0;
  if (opts.factsOverride) facts = opts.factsOverride;
  else {
    const r = await extractFacts(input.transcript, callDate);
    facts = r.facts;
    llmCost = r.costUsd;
  }

  const decision: Decision = qualify(facts);
  const audit = auditTranscript(input.transcript);
  const note = buildHandoffNote({ facts, decision, phone: input.phone, bookedSlot: input.bookedSlot });

  const record: EnquiryRecord = {
    call_id: input.callId,
    phone: input.phone,
    caller_name: facts.callerName,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    duration_sec: input.durationSec,
    outcome: decision.outcome,
    reason: decision.reason,
    facts,
    criteria: decision.criteria,
    handoff_note: note,
    transcript: input.transcript,
    recording_url: input.recordingUrl,
    booked_slot: input.bookedSlot,
    pricing_violation: audit.violation,
    voice_cost_usd: input.voiceCostUsd ?? 0,
    llm_cost_usd: llmCost,
    handoff_seconds: null,
    telegram_message_id: null,
    claimed_by: null,
    hubspot_contact_id: null,
    hubspot_deal_id: null,
    is_sample: opts.isSample ?? false,
    created_at: new Date().toISOString(),
  };

  const inserted = await store.insert(record);
  if (!inserted) return { record: (await store.get(input.callId)) ?? record, duplicate: true };

  const patch: Partial<EnquiryRecord> = {};
  const errors: string[] = [];

  // Only qualified leads and escalations reach designers; declines stay in the dashboard.
  if (decision.outcome === "forward" || decision.outcome === "escalate") {
    try {
      const prefix = decision.outcome === "escalate" ? "ESCALATION\n" : "";
      const msgId = await sendTelegramLead(prefix + note, input.callId, decision.outcome === "forward");
      patch.telegram_message_id = msgId;
      if (msgId) await sendTelegramTranscript(input.transcript, msgId);
      const ref = input.endedAt ?? new Date().toISOString();
      patch.handoff_seconds = Math.max(0, Math.round((Date.now() - new Date(ref).getTime()) / 1000));
    } catch (e) {
      errors.push(`telegram: ${(e as Error).message}`);
    }
  }
  if (decision.outcome === "forward") {
    try {
      const h = await syncHubspot({ name: facts.callerName, phone: input.phone, note, callId: input.callId });
      patch.hubspot_contact_id = h.contactId;
      patch.hubspot_deal_id = h.dealId;
    } catch (e) {
      errors.push(`hubspot: ${(e as Error).message}`);
    }
  }
  if (errors.length) {
    console.error("integration_errors", input.callId, errors);
    patch.reason = `${record.reason} [integration errors: ${errors.join("; ")}]`;
  }
  if (Object.keys(patch).length) {
    await store.update(input.callId, patch);
    Object.assign(record, patch);
  }
  return { record, duplicate: false };
}

/** Telegram "Claim" button: first claim wins. */
export async function claimLead(callId: string, who: string): Promise<{ ok: boolean; by: string }> {
  const store = getStore();
  const r = await store.get(callId);
  if (!r) return { ok: false, by: "" };
  if (r.claimed_by) return { ok: false, by: r.claimed_by };
  await store.update(callId, { claimed_by: who });
  if (r.telegram_message_id) {
    await editTelegramMessage(r.telegram_message_id, `${r.handoff_note}\n\nClaimed by ${who}`).catch(() => {});
  }
  return { ok: true, by: who };
}
