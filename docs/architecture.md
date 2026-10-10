# Architecture

```
Caller ──► Vaani number ──► Voice agent (prompt) ──► Cal.com (Vaani built-in booking)
                              │ call_started (phone) + call_postprocessing
                              ▼
                         /api/webhooks/vaani?token=... (Vercel, Next.js)
                                                   ▼
                                  verify token → join phone by room_name → dedupe by call_id
                                                   ▼
                                  Gemini Flash: transcript → Facts (JSON)
                                                   ▼
                                  qualify.ts (deterministic rubric)
                                    forward | decline | clarify | escalate
                                                   ▼
                    ┌───────────── Supabase row ─────────────┐
                    ▼                       ▼                 ▼
          Telegram (lead + Claim      HubSpot contact     Dashboard
          button + transcript)        + deal              (volume, cost, outcomes)
```

## Key decisions
- **LLM extracts, code decides.** Qualification is a pure function so Nikhil's rubric is testable and auditable. The model cannot "talk itself" into forwarding a Nashik lead.
- **Idempotent on call id** (primary key). Vaani retries never double-post to Telegram or HubSpot.
- **Integrations are independent.** Each runs with a timeout in its own try/catch; no credentials means skipped, not crashed.
- **Only forwards and escalations reach designers.** Declines and clarifies are visible on the dashboard only, so designers are not spammed.
- **Next.js on Vercel:** one deployable for webhook, Telegram callback and dashboard. No separate server.
- **Data model:** single `enquiries` table (`supabase/schema.sql`), RLS on, service-role access only.
- **Cost tracking:** Vaani's webhook has no cost field, so voice cost is estimated as minutes x `VOICE_COST_INR_PER_MIN`; Gemini cost is computed from token usage; dashboard converts at `USD_TO_INR`.
