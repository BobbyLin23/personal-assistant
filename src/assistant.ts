import {
  type DeepSeekLanguageModelChatOptions,
  deepSeek,
} from '@ai-sdk/deepseek'
import { generateText } from 'ai'

/** `deepseek-flash` is DeepSeek's alias for the current V4.x Flash release. */
const MODEL_ID = 'deepseek-v4-flash'

const INSTRUCTIONS =
  'You are a helpful personal assistant chatting over Telegram. ' +
  'Keep replies concise and use plain text.'

/** Ask the model for a reply to a single incoming message. */
export async function generateReply(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: deepSeek(MODEL_ID),
    instructions: INSTRUCTIONS,
    prompt,
    providerOptions: {
      deepseek: {
        // Thinking is on by default for V4 models, which is too slow for a
        // chat reply that has to fit inside Telegram's webhook timeout.
        thinking: { type: 'disabled' }
      } satisfies DeepSeekLanguageModelChatOptions
    }
  })

  return text.trim()
}
