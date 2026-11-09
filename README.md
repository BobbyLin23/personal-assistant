# Personal Assistant

A Telegram echo bot built with Hono. `POST /webhook` receives Telegram updates
and replies with the same text the user sent.

## Setup

```bash
pnpm install
pnpm dev
```

`.env` is loaded automatically in development:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
```

In production (Docker/Railway) the same variables come from the platform
environment, where no `.env` file is present.

## Register the webhook

Telegram must reach the bot over HTTPS. After deploying, point it at
`/webhook`:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://<your-domain>/webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\"]}"
```

Check or remove it:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

`secret_token` accepts only `A-Z`, `a-z`, `0-9`, `_`, and `-` (1–256
characters). Generate a valid one with `openssl rand -hex 32`. Every request
from Telegram must carry it in the `X-Telegram-Bot-Api-Secret-Token` header;
the webhook returns `401` otherwise.

## Endpoints

- `GET /` — health check
- `POST /webhook` — receives a Telegram `Update` and echoes `message.text`

`TELEGRAM_API_BASE` can override `https://api.telegram.org` for local testing
against a stub server.
