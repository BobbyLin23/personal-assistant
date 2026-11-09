# Personal Assistant

A Telegram assistant bot built with a Trigger.dev inbound webhook and a
`chat.agent`. Telegram delivers updates to a hosted, verified Trigger.dev
endpoint; a channel connector turns each text message into a turn on a durable
per-chat session, and the reply is posted back to Telegram with DeepSeek Flash.

The Hono app is still deployed for health checks and the manual AI test route.

## Setup

```bash
pnpm install
npx trigger.dev@latest dev
```

`.env` is loaded automatically in development:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
DEEPSEEK_API_KEY=...
TRIGGER_SECRET_KEY=...
```

`TELEGRAM_WEBHOOK_SECRET` is the shared secret Telegram sends in the
`X-Telegram-Bot-Api-Secret-Token` header. Telegram only accepts `A-Z`, `a-z`,
`0-9`, `_`, and `-` (1–256 characters); `openssl rand -hex 32` produces a valid
one.

## How it fits together

| Piece | File | Role |
| --- | --- | --- |
| `telegramEndpoint` | [src/trigger/telegram.ts](src/trigger/telegram.ts) | Hosted webhook that verifies the Telegram secret and dedupes retries on `update_id` |
| `telegramChannel` | [src/trigger/telegram.ts](src/trigger/telegram.ts) | Maps each chat to a session (`key`), turns text into an inbound message, and posts replies back |
| `telegramAgent` | [src/trigger/telegram.ts](src/trigger/telegram.ts) | Durable chat agent; `storage: defaultStorage` keeps the transcript in Trigger.dev's object storage |

The agent's memory is the transcript the platform saves after every turn. A new
run boots with the prior turns already in context, so no database is needed.
Each Telegram chat is its own session and transcript, keyed by `chat.id`.

## Register the webhook with Telegram

Telegram cannot sign request bodies, so the endpoint verifies the shared secret
instead. The same value must exist in two places: the Trigger.dev endpoint secret
and Telegram's `secret_token`.

### 1. Deploy the Trigger.dev tasks

`trigger dev` or a deploy is what registers the endpoint with Trigger.dev; the
URL exists once the CLI has seen `telegramEndpoint`.

```bash
npx trigger.dev@latest deploy
```

### 2. Store the secret on the endpoint

The CLI reads it from the environment and does not print it:

```bash
npx trigger.dev@latest webhooks set-secret telegram --env prod \
  --from-env TELEGRAM_WEBHOOK_SECRET
```

Use `--env dev` for the development environment.

### 3. Copy the endpoint URL

Open the **Webhooks** page in the Trigger.dev dashboard, select the `telegram`
endpoint, and copy its **Webhook URL** (the same value is on the endpoint's page
and returned by `GET /api/v1/webhooks/endpoints/telegram`). The signing secret
column must show **Ready** before Telegram starts delivering.

### 4. Call `setWebhook`

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{
    \"url\": \"<trigger-webhook-url>\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\"]
  }"
```

`allowed_updates: ["message"]` keeps edits, reactions, and other update types
out of the endpoint. Telegram requires HTTPS on port 443, 80, 88, or 8443.

### 5. Verify

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

The response should show the endpoint URL, a low `pending_update_count`, and no
`last_error_message`. Send the bot a message; the delivery and its run appear on
the endpoint's **Deliveries** tab in the Trigger.dev dashboard.

To roll back to the old webhook:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

## Local development

Each Trigger.dev environment has its own hosted endpoint URL, including `dev`.
Run `npx trigger.dev@latest dev`, copy the URL from the **Webhooks** page for the
dev environment, and register it with `setWebhook` using `--env dev` for the
secret. A bot can only have one webhook at a time, so use a separate test bot
for development, or re-point the production bot when you switch environments.
The endpoint's **Test** tab can send a sample delivery without involving
Telegram.

## Endpoints

- `GET /` — health check
- `GET /test/ai?prompt=...` — temporary test route that triggers the
  `generate-text` task and polls the run

The bot answers with `deepseek-flash`, DeepSeek's alias for the current V4.x
Flash release.

## Environment variables

| Variable | Used by |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Posting replies and calling the Bot API |
| `TELEGRAM_WEBHOOK_SECRET` | Endpoint secret and Telegram `secret_token` |
| `DEEPSEEK_API_KEY` | The agent's model |
| `TRIGGER_SECRET_KEY` | Trigger.dev CLI and SDK |
| `TELEGRAM_API_BASE` | Optional override of `https://api.telegram.org` |
| `DEEPSEEK_BASE_URL` | Optional override of `https://api.deepseek.com` |
