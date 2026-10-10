/**
 * Loads the 19 September phone enquiries (T01-T20, T08 was a missed call) as SAMPLE rows through
 * the real qualification pipeline. Facts are hand-labelled (tests/fixtures.ts), rows are marked
 * is_sample, and no Telegram/HubSpot message is sent for them.
 * Run: npx tsx --env-file=.env.local scripts/seed-samples.ts
 */
import { CASES } from "../tests/fixtures";
import { processCall } from "../src/lib/pipeline";
import { estimateVoiceCostUsd } from "../src/lib/vaani";

// [id, day of Sept 2026, "HH:MM" IST, duration seconds] from the transcript headers
const META: Record<string, [number, string, number]> = {
  T01: [2, "10:23", 252], T02: [3, "14:41", 308], T03: [3, "16:15", 160], T04: [4, "11:07", 202],
  T05: [5, "10:52", 404], T06: [5, "15:28", 301], T07: [8, "09:44", 195], T09: [10, "11:32", 352],
  T10: [11, "14:04", 220], T11: [12, "10:18", 382], T12: [15, "10:05", 450], T13: [16, "12:19", 368],
  T14: [17, "11:41", 295], T15: [18, "15:12", 344], T16: [19, "10:38", 318], T17: [22, "14:16", 270],
  T18: [23, "11:55", 182], T19: [24, "16:02", 170], T20: [25, "09:15", 284],
};

async function main() {
  let n = 0;
  for (const c of CASES) {
    const [day, hm, sec] = META[c.id];
    const start = new Date(`2026-09-${String(day).padStart(2, "0")}T${hm}:00+05:30`);
    const end = new Date(start.getTime() + sec * 1000);
    const { duplicate } = await processCall(
      {
        callId: `sample-${c.id}`,
        phone: null,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        durationSec: sec,
        transcript: `[Sample] September phone enquiry ${c.id} (${c.caller}). ${c.why}. Facts hand-labelled from the anonymised transcript.`,
        recordingUrl: null,
        voiceCostUsd: estimateVoiceCostUsd(sec),
        bookedSlot: null,
      },
      { factsOverride: c.facts, isSample: true },
    );
    if (!duplicate) n++;
  }
  console.log(`seeded ${n} new sample rows (${CASES.length} total cases)`);
}
main().catch((e) => console.log("error:", (e as Error).message));
