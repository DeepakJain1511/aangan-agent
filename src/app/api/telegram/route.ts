import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { answerCallback } from "@/lib/integrations";
import { claimLead } from "@/lib/pipeline";

export const runtime = "nodejs";

/** Telegram webhook (set with secret_token). Handles the "Claim this lead" button; first claim wins. */
export async function POST(req: Request) {
  const secret = env("TELEGRAM_WEBHOOK_SECRET");
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const ok = secret && got.length === secret.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const update = await req.json().catch(() => null);
  const cb = update?.callback_query;
  if (cb?.data?.startsWith("claim:")) {
    const callId = String(cb.data).slice(6);
    const who = cb.from?.username ? `@${cb.from.username}` : (cb.from?.first_name ?? "designer");
    const r = await claimLead(callId, who);
    await answerCallback(cb.id, r.ok ? "Lead claimed: it's yours." : r.by ? `Already claimed by ${r.by}` : "Lead not found");
  }
  return NextResponse.json({ ok: true });
}
