# Requirements traceability

| Requirement (source) | Documentation | Component / file | Evidence | Status |
|---|---|---|---|---|
| Answer every enquiry in 5 min, day or night | automation-brief | Vaani agent, `agent/vaani-agent-setup.md` | Prompt written; **no live call made** | Built, unverified live |
| Worth-it enquiries reach designers with everything asked | brief, component-map | `qualify.ts`, `handoff.ts`, `pipeline.ts` | `tests/qualify.test.ts` (19 transcript cases), handoff tests | Verified (mocked integrations) |
| Never quote per-sq-ft pricing (the Cut) | brief | `pricing-guard.ts`, prompt | `tests/pricing-guard.test.ts` | Verified |
| Phone only; note extension to WhatsApp/form | brief | n/a | Brief section | Done |
| Handoff channel Telegram vs email, justified | brief | `integrations.ts`, `api/telegram` | Claim logic tested; Telegram delivery not live-tested | Built, unverified live |
| Dashboard: volume, outcomes, generated value, cost of the tool | component-map | `metrics.ts`, `dashboard/page.tsx` | Metrics test; page rendered via local HTTP run | Verified locally |
| Automation Brief | `automation-brief.md` | n/a | Written | Done |
| Nine Checks | n/a | n/a | Omitted by user instruction | Skipped |
| Components Map (Trigger→Input→Context→Processing→AI→Output) | `component-map.md` | n/a | Written | Done |
| Idempotency, secrets, auth | architecture | `vaani.ts`, `store.ts`, telegram route | Tests + local 401/duplicate check | Verified |
| Build and tests pass | setup | n/a | `npm test` 50 pass; `next build` OK | Verified |
| Deployment | setup | n/a | Instructions only; not deployed | Needs your accounts |
| Live end-to-end on Vercel + Supabase + Telegram + HubSpot | setup | `scripts/e2e-live.ts` | Fake Vaani call -> row, Telegram message, HubSpot deal, duplicate ignored; records cleaned up | Verified (simulated call) |
| Real Vaani call end to end | assumptions 13, 14 | n/a | No inbound number or webhook setting available yet | **Not verified** |
