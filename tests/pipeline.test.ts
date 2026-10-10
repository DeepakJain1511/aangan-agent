import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coerceFacts, heuristicExtract } from "@/lib/extract";
import { splitText } from "@/lib/integrations";
import { computeMetrics, isAfterHoursIST } from "@/lib/metrics";
import { claimLead, processCall } from "@/lib/pipeline";
import { memoryStore, setStoreForTests } from "@/lib/store";
import { normaliseTranscript, parseCallStarted, parsePostprocessing, slotFromEntities, verifyToken } from "@/lib/vaani";
import { CASES } from "./fixtures";

const call = (id: string, transcript = "Caller: hi\nAI: hello") => ({
  callId: id, phone: "+919800000000", startedAt: "2026-09-03T09:00:00Z", endedAt: "2026-09-03T09:03:00Z",
  durationSec: 180, transcript, recordingUrl: null, voiceCostUsd: 0.12, bookedSlot: null,
});

beforeEach(() => {
  setStoreForTests(memoryStore());
  for (const k of ["TELEGRAM_BOT_TOKEN", "HUBSPOT_TOKEN", "GEMINI_API_KEY", "SUPABASE_URL"]) delete process.env[k];
});
afterEach(() => setStoreForTests(null));

describe("pipeline", () => {
  it("is idempotent: a re-delivered webhook does not create or process twice", async () => {
    const facts = CASES[0].facts;
    const a = await processCall(call("c1"), { factsOverride: facts });
    const b = await processCall(call("c1"), { factsOverride: facts });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
  });

  it("works with no integration credentials (declines + forwards still stored)", async () => {
    const r = await processCall(call("c2"), { factsOverride: CASES[0].facts });
    expect(r.record.outcome).toBe("forward");
    expect(r.record.handoff_note).toMatch(/Kothrud/);
  });

  it("handoff note never contains a price", async () => {
    const r = await processCall(call("c3"), { factsOverride: CASES[1].facts });
    expect(r.record.handoff_note).not.toMatch(/₹|lakh|per sq/i);
    expect(r.record.handoff_note).toMatch(/deflected/);
  });

  it("flags an agent turn that quoted a price", async () => {
    const r = await processCall(call("c4", "Caller: cost?\nAI: about 15 lakh"), { factsOverride: CASES[1].facts });
    expect(r.record.pricing_violation).toBe(true);
  });

  it("first claim wins", async () => {
    await processCall(call("c5"), { factsOverride: CASES[0].facts });
    expect((await claimLead("c5", "@asha")).ok).toBe(true);
    const second = await claimLead("c5", "@ravi");
    expect(second.ok).toBe(false);
    expect(second.by).toBe("@asha");
  });

  it("a failing Telegram call does not block storage or HubSpot attempt", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "x";
    process.env.TELEGRAM_CHAT_ID = "1";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    const r = await processCall(call("c6"), { factsOverride: CASES[0].facts });
    expect(r.record.reason).toMatch(/integration errors: telegram/);
    vi.unstubAllGlobals();
  });
});

describe("vaani payloads", () => {
  it("token check fails closed when unset and rejects wrong tokens", () => {
    delete process.env.VAANI_WEBHOOK_TOKEN;
    expect(verifyToken("anything")).toBe(false);
    process.env.VAANI_WEBHOOK_TOKEN = "s3cret";
    expect(verifyToken(null)).toBe(false);
    expect(verifyToken("wrong!")).toBe(false);
    expect(verifyToken("s3cret")).toBe(true);
  });

  it("reads the caller number from call_started", () => {
    expect(parseCallStarted({ event: "call_started", room_name: "r1", phone_number: "+9198" })).toEqual({ roomName: "r1", phone: "+9198" });
    expect(parseCallStarted({ event: "call_ended" })).toBeNull();
  });

  it("parses call_postprocessing: ms duration, entities slot, normalised transcript", () => {
    delete process.env.VOICE_COST_INR_PER_MIN;
    const p = parsePostprocessing(
      { event: "call_postprocessing", call_id: "x", timestamp: "2026-09-03T09:03:00Z",
        data: { room_name: "r1", call_id: "x", call_duration: 180000, recording_url: "https://r/x.ogg",
          entities: { meeting_slot: "Mon 12 Oct 10:00" }, transcript: "[00:01] AGENT: Aangan Studio.\n[00:03] USER: Hi, I am Priya" } },
      "+9198",
    );
    expect(p?.durationSec).toBe(180);
    expect(p?.phone).toBe("+9198");
    expect(p?.bookedSlot).toBe("Mon 12 Oct 10:00");
    expect(p?.transcript).toBe("AI: Aangan Studio.\nCaller: Hi, I am Priya");
    expect(parsePostprocessing({ event: "call_postprocessing", data: {} }, null)).toBeNull();
    expect(parsePostprocessing({ event: "call_ended" }, null)).toBeNull();
  });

  it("transcript as an object array and slot placeholders", () => {
    expect(normaliseTranscript([{ role: "user", text: "hi" }, { role: "agent", text: "hello" }])).toBe("Caller: hi\nAI: hello");
    expect(slotFromEntities({ meeting_slot: "not booked" })).toBeNull();
    expect(slotFromEntities(null)).toBeNull();
  });

  it("estimates voice cost from duration only when a rate is configured", () => {
    process.env.VOICE_COST_INR_PER_MIN = "8";
    const p = parsePostprocessing({ event: "call_postprocessing", data: { call_id: "y", call_duration: 120000, transcript: "USER: hi" } }, null);
    expect(p?.voiceCostUsd).toBeCloseTo((2 * 8) / 88, 5);
    delete process.env.VOICE_COST_INR_PER_MIN;
  });
});

describe("extraction", () => {
  it("coerceFacts rejects garbage shapes", () => {
    const f = coerceFacts({ intent: "hack", areaSqft: "lots", budgetLakh: -4, decisionMaker: 7 });
    expect(f.intent).toBe("other");
    expect(f.areaSqft).toBeNull();
    expect(f.budgetLakh).toBeNull();
    expect(f.decisionMaker).toBe("unknown");
  });

  it("heuristic fallback catches an out-of-area caller", () => {
    const f = heuristicExtract("Caller: I'm in Nashik, want to redo my home office", new Date("2026-09-03"));
    expect(f.inServiceArea).toBe("no");
  });

  it("heuristic fallback reads a volunteered budget", () => {
    const f = heuristicExtract("Caller: 1BHK in Kharadi, 550 sq ft. My budget is 1 to 1.5 lakh maximum", new Date("2026-09-11"));
    expect(f.budgetLakh).toBe(1.5);
    expect(f.inServiceArea).toBe("yes");
  });
});

describe("metrics and helpers", () => {
  it("after-hours is judged in IST", () => {
    expect(isAfterHoursIST("2026-09-09T17:17:00Z")).toBe(true); // 10:47pm IST
    expect(isAfterHoursIST("2026-09-02T04:53:00Z")).toBe(false); // 10:23am IST
  });

  it("computes cost per qualified lead from voice + LLM cost", async () => {
    await processCall(call("m1"), { factsOverride: CASES[0].facts });
    await processCall(call("m2"), { factsOverride: CASES[2].facts });
    const rows = await (await import("@/lib/store")).getStore().list();
    const m = computeMetrics(rows);
    expect(m.total).toBe(2);
    expect(m.byOutcome.forward).toBe(1);
    expect(m.costPerQualifiedLeadInr).toBeCloseTo(0.24 * 88, 1);
  });

  it("splits long text under Telegram's limit", () => {
    const parts = splitText(("x".repeat(100) + "\n").repeat(100), 3900);
    expect(parts.every((p) => p.length <= 3900)).toBe(true);
    expect(parts.length).toBeGreaterThan(1);
  });
});
