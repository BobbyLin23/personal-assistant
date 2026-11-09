## Hono CLI

Run `npx hono --help` first, and use the CLI instead of a dev server.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-authoring-tasks`, `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->

## Railway environment variables

Never overwrite Railway's `TRIGGER_SECRET_KEY` with the local development value.

The `TRIGGER_SECRET_KEY` in `.env` is a development key and is not valid for production. Whenever syncing environment variables to Railway (including via the Railway skill or CLI), exclude `TRIGGER_SECRET_KEY` so the production key configured in Railway is left untouched.
