import {
  type DeepSeekLanguageModelChatOptions,
  deepSeek,
} from '@ai-sdk/deepseek'
import { task } from '@trigger.dev/sdk'
import { generateText } from 'ai'

/** `deepseek-flash` is DeepSeek's alias for the current V4.x Flash release. */
const MODEL_ID = 'deepseek-v4-flash'

const INSTRUCTIONS =
  'You are a helpful assistant. Keep replies concise and use plain text.'

/** Temporary task backing the public /test/ai endpoint. */
export const generateTextTask = task({
  id: 'generate-text',
  run: async (payload: { prompt: string }) => {
    const { text } = await generateText({
      model: deepSeek(MODEL_ID),
      instructions: INSTRUCTIONS,
      prompt: payload.prompt,
      providerOptions: {
        deepseek: {
          // Thinking is on by default for V4 models, which is too slow for a
          // simple test endpoint.
          thinking: { type: 'disabled' },
        } satisfies DeepSeekLanguageModelChatOptions,
      },
    })

    return { text: text.trim() }
  },
})
