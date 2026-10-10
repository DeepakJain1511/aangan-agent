# Assumptions and honest limitations

1. **Nine Checks omitted.** The pre-read says they come from session notes that are not in the materials; the user instructed to ignore them. No nine-check document exists.
2. **Fresh build.** `SYSTEM_STATUS.md` in the parent folder describes a different, already-live system. Per instruction it was treated as reference only; none of its claims are verified or reused here.
3. **Brief says "Arjun"** once; the founder is Nikhil everywhere else. Treated as Nikhil.
4. **Thresholds:** 6-week minimum lead (services.md); the rubric's "8 to 10 weeks" is used only as a "tight" note. Office 500 to 3,000 sq ft (T18 declined a 180 sq ft pod; services.md caps at ~3,000). Budget floor 3.5 lakh: the smallest all-in figure in pricing.md; below it with any scope is "clearly misaligned" (T10). Residential has no size cap (T12, 5,500 sq ft villa, was forwarded).
5. **Declines never forward** (rubric: "close gracefully"), even single-criterion fails.
6. **T16 (dropped enquiry)** is modelled as "clarify" because no timeline was given.
7. **Booking is done by Vaani's built-in Cal.com integration** (docs.vaanivoice.ai/guides/integrations), not by our code. Its docs do not describe the tools, so how it gets an attendee email is unverified. The booked slot reaches us only through an extraction field named `meeting_slot` that you must configure in Vaani.
7b. **Vaani webhook facts (from its docs):** no signature is documented, so a secret `?token=` in the URL authenticates; the caller number arrives only in `call_started` (joined by room_name); there is no cost field, so cost is an estimate from duration; the exact transcript line format is not documented, so the parser accepts `AGENT:`/`USER:` lines with optional timestamps and was tested only on that assumed shape.
8. **Pipeline value** on the dashboard = forwarded leads x ₹11 lakh (midpoint of ₹8 to 14 lakh). Indicative, not revenue.
9. **Gemini price** hard-coded as $0.30 / $2.50 per million input/output tokens; update if pricing changes.
10. **Not verified live (no credentials in this environment):** real Vaani calls, Gemini extraction, Telegram delivery, HubSpot sync, Cal.com booking, Supabase. They are unit-tested with mocked HTTP where practical and run in skip mode otherwise. The first real call is the first real proof.
11. **Not built:** reminder after 30 unclaimed minutes; WhatsApp and web form (out of scope per brief); recording playback on dashboard (URL stored only); the Vaani assistant itself must be created in the Vaani console from `agent/vaani-agent-setup.md`.
12. Heuristic fallback extractor is conservative and English-only; Gemini is the intended path. Test fixtures use hand-labelled facts, so the extractor itself is not scored against the 19 transcripts.
