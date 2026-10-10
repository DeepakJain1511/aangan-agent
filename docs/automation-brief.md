# Automation Brief: Aangan Studio phone enquiry agent

## The Why
| | |
|---|---|
| **Pain** | ~200 enquiries a month; ~48% get no reply within 48 hours; ~33% arrive outside 10am to 7pm when the 2-person front desk is off. An enquiry answered within an hour converts at 4x the next-day rate. Leads that do reach a designer arrive as a forwarded message with no context, so the designer re-asks everything. |
| **User** | Primary: Nikhil Deshpande (founder), who owns the outcome. Secondary: Aangan's 14 designers (receive the lead) and the callers (want an answer now). |
| **Outcome** | Every incoming call is answered within seconds, day or night. Worth-it enquiries reach a designer with everything already asked and a consultation slot booked. Nikhil sees volume, outcomes and running cost on a dashboard and never pulls numbers by hand again. |

## The Journey Today (phone only, from the Sept transcripts)
1. Caller rings the studio line. Between 7pm and 10am, or when both desk staff are busy, nobody answers (T08: missed call at 10:47pm, callback next day also unanswered).
2. If answered, the front desk asks scope, size, timeline, ownership and offers a consultation (T01, T05, T06).
3. The desk improvises on price: sometimes deflects well (T02, T13), but nothing stops a number being quoted.
4. Qualified details are forwarded to a designer as a loose message. Designer re-asks the same questions.
5. Dropped follow-ups: "I called Monday, no note" (T16); frustrated callers (T09).
6. Nobody measures any of it. Nikhil pulled numbers manually.

## The Cut
Nikhil asked for the system to "quote our standard per-square-foot pricing". **We do not build that.** `pricing.md` is explicitly "indicative only, varies by site" and forbids quoting any figure. Quoting would create commitments the studio cannot honour, so the agent deflects every price question (and the guard blocks numbers). Callers who ask still get booked: T02 and T13 both book after a deflection.

## Automation (Trigger → decisions → outputs)
- **Purpose:** answer every inbound call, qualify against Nikhil's five-criterion rubric, book a consultation, and hand the designer a complete note.
- **Trigger:** an inbound call to the Vaani number. Post-call, Vaani posts an `call_postprocessing` webhook.
- **Inputs:** live call audio; after the call, transcript, recording URL, caller number, cost.
- **Workflow:** (1) Vaani voice agent converses by the prompt in `agent/vaani-agent-setup.md`; books via Vaani's built-in Cal.com integration. (2) The `call_postprocessing` webhook is authenticated and deduplicated by call id. (3) Gemini Flash extracts structured facts from the transcript. (4) Deterministic rules (`qualify.ts`) decide. (5) Outputs fan out.
- **Decision logic:** complaint → escalate. Any failed criterion → decline politely. Unclear real-project / area / timeline → one clarifying question. Unclear budget or decision-maker → forward, with the uncertainty in the note. All pass → forward.
- **AI tasks:** (a) conversation (Vaani agent), (b) fact extraction (Gemini Flash). The AI never decides who qualifies, and never states a price.
- **Integrations:** Vaani (voice), Gemini Flash (extraction), Cal.com (booking), Telegram (handoff), HubSpot (CRM), Supabase (database), Vercel (hosting), GitHub (version control).
- **Outputs:** Telegram lead with Claim button and transcript reply; HubSpot contact (upserted by phone) and deal; database row; dashboard.
- **Failure handling:** unauthenticated webhook → 401; duplicate delivery → no-op; each integration in its own try/catch with timeout, failure recorded in the row and logged while the others continue; no credentials → that integration is skipped and the rest still works; Gemini failure → heuristic extractor; booking tool failure → the agent says a designer will call.
- **Success conditions:** call answered 24/7; handoff to designer within 5 minutes of call end; zero price quotes (dashboard counter stays 0); cost per qualified lead visible.

## Handoff channel: Telegram (not email)
Designers claim leads from their phones in seconds; email gets buried and cannot do "first claim wins". Telegram supports an inline Claim button, a reply thread for the transcript, and instant push. Email is only better for formal records, which HubSpot already holds.

## Extending to WhatsApp and the web form (not built)
Both channels reuse everything after the trigger: the same `processCall` pipeline accepts any `{transcript, phone}`. A WhatsApp Business webhook or form handler would only need an adapter that builds a `CallInput` and a chat loop in place of Vaani.
