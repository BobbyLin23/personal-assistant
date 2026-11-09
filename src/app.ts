import { timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { generateReply } from './assistant.js'
import type { TelegramUpdate } from './telegram.js'

const TELEGRAM_API_BASE =
  process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org'

/** Constant-time comparison so the secret can't be guessed by timing. */
function isValidSecret(provided: string | undefined, expected: string | undefined) {
  if (!provided || !expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Telegram rejects messages longer than this many characters. */
const MAX_MESSAGE_LENGTH = 4096

function truncateForTelegram(text: string) {
  return text.length <= MAX_MESSAGE_LENGTH
    ? text
    : `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
}

/** Send text to the same chat, replying to the original message. */
export async function sendMessage(
  chatId: number,
  text: string,
  replyToMessageId?: number
) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: truncateForTelegram(text)
  }
  if (replyToMessageId !== undefined) {
    body.reply_parameters = {
      message_id: replyToMessageId,
      // Still deliver the reply if the original message was deleted.
      allow_sending_without_reply: true
    }
  }

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    throw new Error(
      `Telegram sendMessage failed (${res.status}): ${await res.text()}`
    )
  }
}

const app = new Hono()

app.get('/', (c) => c.text('Telegram assistant bot is running'))

app.post('/webhook', async (c) => {
  if (
    !isValidSecret(
      c.req.header('X-Telegram-Bot-Api-Secret-Token'),
      process.env.TELEGRAM_WEBHOOK_SECRET
    )
  ) {
    return c.text('Unauthorized', 401)
  }

  let update: TelegramUpdate
  try {
    update = await c.req.json<TelegramUpdate>()
  } catch {
    return c.text('Bad Request', 400)
  }

  const message = update.message
  if (message?.text !== undefined) {
    try {
      const reply = await generateReply(message.text)
      await sendMessage(
        message.chat.id,
        reply || 'Sorry, I could not generate a reply.',
        message.message_id
      )
    } catch (error) {
      // Acknowledge anyway: returning non-2xx makes Telegram redeliver the same
      // update, which would duplicate the reply once the API recovers.
      console.error('Failed to answer message:', error)
    }
  }

  return c.body(null, 200)
})

export default app
