import {
  type DeepSeekLanguageModelChatOptions,
  deepSeek,
} from '@ai-sdk/deepseek'
import { webhooks } from '@trigger.dev/sdk'
import { chat, defaultStorage } from '@trigger.dev/sdk/ai'
import type { TelegramUpdate } from '../telegram.js'

/** `deepseek-flash` is DeepSeek's alias for the current V4.x Flash release. */
const MODEL_ID = 'deepseek-v4-flash'

const INSTRUCTIONS =
  'You are a helpful personal assistant chatting over Telegram. ' +
  'Keep replies concise and use plain text.'

const TELEGRAM_API_BASE =
  process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org'

/** Telegram rejects messages longer than this many characters. */
const MAX_MESSAGE_LENGTH = 4096

function truncateForTelegram(text: string) {
  return text.length <= MAX_MESSAGE_LENGTH
    ? text
    : `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
}

/**
 * The hosted Trigger.dev endpoint Telegram delivers to.
 *
 * Telegram cannot sign request bodies, so it proves its identity with the
 * `secret_token` passed to `setWebhook`, which it echoes in the
 * `X-Telegram-Bot-Api-Secret-Token` header. That is a shared secret, and the
 * endpoint dedupes retried deliveries on the update's `update_id`.
 */
export const telegramEndpoint = webhooks.endpoint.define({
  id: 'telegram',
  description: 'Telegram Bot API updates for the personal assistant',
  source: webhooks.custom<TelegramUpdate>(
    {
      scheme: 'shared-secret',
      placement: 'header',
      fieldName: 'x-telegram-bot-api-secret-token',
      idempotencyField: { from: 'body', name: 'update_id' },
    },
    {
      setupPrompt:
        'Register this endpoint URL with Telegram by calling ' +
        '`setWebhook` with `url=<endpoint URL>`, ' +
        '`secret_token=<the endpoint secret>` and `allowed_updates=["message"]`. ' +
        'Telegram echoes the secret in the X-Telegram-Bot-Api-Secret-Token header.',
    }
  ),
})

/** The Telegram chat a bound session answers into. */
type TelegramHandle = { chatId: number }

/**
 * Makes the agent a Telegram chat frontend: each text message becomes a turn,
 * the reply is posted back to the same chat, and the chat id is the session key
 * so one conversation is one durable session.
 */
export const telegramChannel = chat.channels.custom({
  id: 'telegram',
  endpoint: telegramEndpoint,
  // One session (and therefore one transcript) per Telegram chat.
  key: '{event.message.chat.id}',
  // Only answer text messages from humans; Telegram never sends the bot its
  // own messages, but other bots can post in groups.
  filter: 'event.message.text != null && event.message.from.is_bot == false',
  inbound: (event) => ({
    message: event.message?.text ?? '',
    externalUserId: event.message?.from
      ? String(event.message.from.id)
      : undefined,
    externalMessageId: event.message
      ? String(event.message.message_id)
      : undefined,
  }),
  bind: (event) =>
    event.message ? { chatId: event.message.chat.id } : null,
  // Stay silent when the model produced no text (for example an empty turn).
  outbound: (reply) => (reply.text.trim() ? { text: reply.text } : null),
  send: async (message, ctx) => {
    const chatId = ctx.handle?.chatId ?? ctx.event?.message?.chat.id
    if (chatId === undefined) return {}

    const messageId = await sendTelegramMessage(
      chatId,
      message.text,
      ctx.event?.message?.message_id
    )
    return { ref: messageId === undefined ? undefined : String(messageId) }
  },
})

/**
 * Durable chat agent over Telegram.
 *
 * `storage: defaultStorage` is the platform transcript snapshot in object
 * storage: the whole conversation is saved after every turn, so a new run boots
 * with the prior turns in context. That gives the agent memory with no
 * database and no migrations.
 */
export const telegramAgent = chat.agent({
  id: 'telegram-assistant',
  system: INSTRUCTIONS,
  storage: defaultStorage,
  channels: [telegramChannel],
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: deepSeek(MODEL_ID),
      messages,
      // Forwarding the signal makes a cancel/stop abort generation server-side.
      abortSignal: signal,
      providerOptions: {
        deepseek: {
          // Thinking is on by default for V4 models, which is too slow for a
          // chat reply.
          thinking: { type: 'disabled' },
        } satisfies DeepSeekLanguageModelChatOptions,
      },
    }),
})

/** Post text to a Telegram chat, optionally replying to the triggering message. */
async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyToMessageId?: number
) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: truncateForTelegram(text),
    link_preview_options: { is_disabled: true },
  }
  if (replyToMessageId !== undefined) {
    body.reply_parameters = {
      message_id: replyToMessageId,
      // Still deliver the reply if the original message was deleted.
      allow_sending_without_reply: true,
    }
  }

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(
      `Telegram sendMessage failed (${res.status}): ${await res.text()}`
    )
  }

  const payload = (await res.json()) as {
    result?: { message_id?: number }
  }
  return payload.result?.message_id
}
