import crypto from "node:crypto";
import { env } from "./config";
import type { CallInput } from "./types";

/**
 * Vaani (app.vaanivoice.ai) webhook helpers. Docs: docs.vaanivoice.ai/guides/webhook-setup
 * Documented facts we rely on:
 *  - `call_started` carries room_name + phone_number (the only event with the caller's number)
 *  - `call_postprocessing` carries { event, call_id, timestamp, data: { room_name, call_id,
 *    call_duration (ms), summary, entities, dispositions, recording_url, transcript } }
 *  - no signature scheme and no cost field are documented.
 * So: we authenticate with a secret token in the webhook URL, and estimate cost from duration.
 */

/** Constant-time check of the `?token=` secret in the webhook URL. Fails closed if unset. */
export function verifyToken(token: string | null): boolean {
  const secret = env("VAANI_WEBHOOK_TOKEN");
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Normalise Vaani's "AGENT:/USER:" (possibly timestamped) transcript to "AI:/Caller:" lines. */
export function normaliseTranscript(t: unknown): string {
  if (Array.isArray(t)) {
    return t
      .map((x) => {
        const o = x as Record<string, unknown>;
        const who = String(o.role ?? o.speaker ?? "").toLowerCase();
        const text = String(o.text ?? o.content ?? o.message ?? "");
        return text ? `${/user|caller|customer/.test(who) ? "Caller" : "AI"}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof t !== "string") return "";
  return t
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^\s*(?:[\[(]?[\d:.\-\sTZ/]+[\])]?\s*)?(AGENT|AI|ASSISTANT|BOT|USER|CALLER|CUSTOMER)\s*[:\]-]\s*(.*)$/i);
      if (!m) return line.trim();
      return `${/^(user|caller|customer)$/i.test(m[1]) ? "Caller" : "AI"}: ${m[2]}`;
    })
    .filter(Boolean)
    .join("\n");
}

const SLOT_KEYS = ["meeting_slot", "consultation_slot", "booked_slot", "appointment_time", "meeting_time"];

/** Find a booked consultation slot among the entities extracted by Vaani (field names we configure). */
export function slotFromEntities(entities: unknown): string | null {
  if (!entities || typeof entities !== "object") return null;
  const e = entities as Record<string, unknown>;
  for (const k of SLOT_KEYS) {
    const v = e[k];
    if (typeof v === "string" && v.trim() && !/^(none|null|n\/a|not (booked|scheduled))/i.test(v.trim())) return v.trim();
  }
  return null;
}

/** Voice cost is not in Vaani's webhook, so estimate: minutes x VOICE_COST_INR_PER_MIN, in USD. */
export function estimateVoiceCostUsd(durationSec: number | null): number {
  const perMinInr = Number(env("VOICE_COST_INR_PER_MIN") ?? 0);
  const fx = Number(env("USD_TO_INR") ?? 88);
  if (!durationSec || !perMinInr) return 0;
  return ((durationSec / 60) * perMinInr) / fx;
}

export interface StartedEvent {
  roomName: string;
  phone: string;
}

export function parseCallStarted(body: any): StartedEvent | null {
  if (body?.event !== "call_started") return null;
  const room = body.room_name ?? body.call_id;
  return typeof room === "string" && typeof body.phone_number === "string" ? { roomName: room, phone: body.phone_number } : null;
}

/** Parse `call_postprocessing`. Returns null if it lacks an id. `phone` is joined in by the route. */
export function parsePostprocessing(body: any, phone: string | null): CallInput | null {
  if (body?.event !== "call_postprocessing") return null;
  const d = (body.data ?? {}) as Record<string, any>;
  const callId = d.call_id ?? body.call_id ?? d.room_name;
  if (typeof callId !== "string") return null;
  const ms = typeof d.call_duration === "number" ? d.call_duration : null; // milliseconds here
  const durationSec = ms === null ? null : Math.round(ms / 1000);
  const ts = typeof body.timestamp === "string" || typeof body.timestamp === "number" ? new Date(body.timestamp) : new Date();
  const ended = isNaN(+ts) ? new Date() : ts;
  const started = new Date(ended.getTime() - (durationSec ?? 0) * 1000);
  return {
    callId,
    phone,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    durationSec,
    transcript: normaliseTranscript(d.transcript),
    recordingUrl: typeof d.recording_url === "string" ? d.recording_url : null,
    voiceCostUsd: estimateVoiceCostUsd(durationSec),
    bookedSlot: slotFromEntities(d.entities),
    roomName: typeof d.room_name === "string" ? d.room_name : callId,
    entities: (d.entities ?? null) as Record<string, unknown> | null,
  };
}
