# Component Map: Trigger → Input → Context → Processing → AI → Output

| Stage | Component | File | Responsibility | Tech | Errors |
|---|---|---|---|---|---|
| **Trigger** | Inbound call; end-of-call webhook | Vaani; `src/app/api/webhooks/vaani/route.ts` | Answer instantly; notify us when the call ends | Vaani | Token check (401), invalid JSON (400), empty transcript skipped |
| **Input** | Payload parser | `src/lib/vaani.ts` | Turn the Vaani report into a `CallInput`; constant-time token check, phone join, duration/cost | TypeScript | Returns null if no call id |
| **Context** | Business knowledge | `agent/vaani-agent-setup.md`, `src/lib/config.ts` | services.md, pricing.md, qualified.md encoded as agent prompt and numeric thresholds (6-week lead, 500 to 3,000 sq ft offices, 3.5 lakh budget floor) | Markdown / TS | n/a |
| **Processing 1** | Fact extraction orchestrator | `src/lib/extract.ts` | Gemini JSON → validated `Facts` (`coerceFacts`), heuristic fallback | Gemini Flash REST | 15s timeout, falls back |
| **Processing 2** | Qualification rules | `src/lib/qualify.ts` | Rubric → forward / decline / clarify / escalate with per-criterion evidence | Pure TS | Deterministic, unit tested |
| **Processing 3** | Pricing guard | `src/lib/pricing-guard.ts` | Audit agent turns for any quoted number; sanitise outgoing text | Regex | Violations flagged on the record |
| **Processing 4** | Handoff builder | `src/lib/handoff.ts` | Compose the designer note (no price ever) | TS | n/a |
| **AI** | Voice agent | Vaani assistant | Conversation, one question per turn, books via Cal.com | Vaani + LLM | Unbooked → note asks designer to schedule |
| **AI** | Extractor | Gemini Flash | Facts only; no decisions | Gemini | See above |
| **Output** | Orchestrator | `src/lib/pipeline.ts` | Idempotent processing; fan-out; isolates integration failures | TS | Per-integration try/catch |
| **Output** | Telegram | `src/lib/integrations.ts`, `src/app/api/telegram/route.ts` | Lead + transcript reply + Claim button (first claim wins) | Telegram Bot API | Webhook secret; failure recorded |
| **Output** | HubSpot | `src/lib/integrations.ts` | Upsert contact by phone, create deal | HubSpot CRM v3 | Failure recorded |
| **Output** | Cal.com (inside Vaani) | Vaani Integrations | Books during the call; slot returned to us via the `meeting_slot` entity | Cal.com | Unbooked calls say "consultation not yet booked" in the note |
| **Output** | Store | `src/lib/store.ts`, `supabase/schema.sql` | One row per call (PK = call id); JSON file fallback locally | Supabase | Duplicate insert ignored |
| **Output** | Dashboard | `src/app/dashboard/page.tsx`, `src/lib/metrics.ts` | Volume, outcomes, after-hours share, handoff time, cost per call and per qualified lead, pipeline, price-violation counter | Next.js | Key-protected, fails closed |
| Hosting / VCS | Vercel / GitHub | n/a | Deploy and version | n/a | n/a |

Not used (and why): Resend/email (Telegram chosen), Calendly/Google Calendar (Cal.com chosen), Neon (Supabase chosen).
