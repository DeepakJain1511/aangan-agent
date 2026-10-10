# Setup and deployment

## Local
```bash
cd aangan-agent
cp .env.example .env.local     # fill in what you have; every key is optional locally
npm install
npm test                       # 50 tests
npm run build
npm run dev                    # http://localhost:3000
```
With no keys: a JSON file store (`data/store.json`), heuristic extraction, and integrations are skipped. Set `VAANI_WEBHOOK_TOKEN` and `DASHBOARD_KEY` to exercise the webhook and dashboard.

Simulate a call:
```bash
curl -X POST "localhost:3000/api/webhooks/vaani?token=$VAANI_WEBHOOK_TOKEN" -H "content-type: application/json" --data-binary @payload.json   # payloads: call_started / call_postprocessing
```
Dashboard: `/dashboard?key=<DASHBOARD_KEY>` (add `&show=all` to include sample rows).

## External setup (needs your accounts)
1. **Supabase:** create a project, run `supabase/schema.sql`, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. **Vaani:** follow `agent/vaani-agent-setup.md` (agent prompt, `meeting_slot` extraction field, Cal.com integration, webhook URL with `?token=`, phone number). Calls cost money: approve before the first one.
3. **Gemini:** API key from Google AI Studio → `GEMINI_API_KEY`.
4. **Telegram:** create a bot with @BotFather, add it to the designer group, set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`; register the webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domain>/api/telegram&secret_token=<SECRET>`.
5. **HubSpot:** private app token with contacts and deals write scope → `HUBSPOT_TOKEN`.
6. **Cal.com:** create a "Design consultation" event and give Vaani the API key (in Vaani's Integrations settings, not in our env).
7. **Vercel:** import the GitHub repo, set the root directory to `aangan-agent`, add all env vars, deploy. Never commit `.env*`.

## Env vars
See `.env.example` (placeholders only).
