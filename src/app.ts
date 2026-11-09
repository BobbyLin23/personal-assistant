import { runs, tasks } from '@trigger.dev/sdk'
import { Hono } from 'hono'
import type { generateTextTask } from './trigger/generate-text.js'

const app = new Hono()

app.get('/', (c) => c.text('Telegram assistant bot is running'))

// TEMPORARY: public test endpoint for the Trigger.dev + AI SDK wiring.
// Triggers a task and polls the run so the generated text can be returned.
// Remove this route once it has served its purpose.
app.get('/test/ai', async (c) => {
  const prompt = c.req.query('prompt') ?? 'Say hello in one short sentence.'

  try {
    const handle = await tasks.trigger<typeof generateTextTask>(
      'generate-text',
      { prompt }
    )
    const run = await runs.poll<typeof generateTextTask>(handle.id, {
      pollIntervalMs: 1000
    })

    if (!run.isSuccess) {
      return c.json(
        { error: `Run ${handle.id} finished with status ${run.status}` },
        500
      )
    }

    return c.json({ prompt, text: run.output?.text ?? '' })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : String(error) },
      500
    )
  }
})

// Telegram updates are delivered to the Trigger.dev-hosted webhook endpoint
// declared in src/trigger/telegram.ts, not to this Hono app.

export default app
