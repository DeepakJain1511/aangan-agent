import { NextResponse } from "next/server";
import { processCall } from "@/lib/pipeline";
import { getStore } from "@/lib/store";
import { parseCallStarted, parsePostprocessing, verifyToken } from "@/lib/vaani";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vaani webhook (register `https://<domain>/api/webhooks/vaani?token=<VAANI_WEBHOOK_TOKEN>`
 * under Settings -> Webhooks). Vaani documents no signature, so the secret token is the auth.
 * - call_started: remember the caller's number by room_name
 * - call_postprocessing: transcript is ready; qualify and hand off
 * Always answers 200 to events we ignore so Vaani does not retry them.
 */
export async function POST(req: Request) {
  if (!verifyToken(new URL(req.url).searchParams.get("token"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const store = getStore();

  const started = parseCallStarted(body);
  if (started) {
    await store.setMeta(started.roomName, started.phone).catch((e) => console.error("meta_failed", e.message));
    return NextResponse.json({ ok: true, stored: "phone" });
  }

  if (body?.event === "call_postprocessing") {
    const room = body?.data?.room_name ?? body?.data?.call_id ?? body?.call_id;
    const phone = typeof room === "string" ? await store.getMeta(room).catch(() => null) : null;
    const input = parsePostprocessing(body, phone);
    if (!input) return NextResponse.json({ error: "missing call id" }, { status: 400 });
    if (!input.transcript.trim()) return NextResponse.json({ ok: true, skipped: "empty transcript" });
    const { record, duplicate } = await processCall(input);
    return NextResponse.json({ ok: true, duplicate, outcome: record.outcome });
  }
  return NextResponse.json({ ok: true, ignored: body?.event ?? "unknown" });
}
