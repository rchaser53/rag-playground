import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

import { config } from './config.js';
import { serialize, withRetry } from './retry.js';

export type LlmProvider = 'openai' | 'gemini';

export function getChatModel() {
  const provider = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase();

  if (provider === 'gemini' || provider === 'google' || provider === 'google-genai') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing env var: GEMINI_API_KEY (required for LLM_PROVIDER=gemini)');

    // Model name examples: gemini-1.5-flash, gemini-1.5-pro
    const model = process.env.GEMINI_CHAT_MODEL ?? config.chatModel;

    const base = new ChatGoogleGenerativeAI({
      apiKey,
      model,
      temperature: 0.2
    });

    return {
      invoke: (input: any, options?: any) => serialize(() => withRetry(() => (base as any).invoke(input, options), {}))
    } as any;
  }

  const base = new ChatOpenAI({
    apiKey: (() => {
      const key = config.openaiApiKey;
      if (!key) throw new Error('Missing env var: OPENAI_API_KEY (required for LLM_PROVIDER=openai)');
      return key;
    })(),
    model: config.chatModel,
    temperature: 0.2
  });

  return {
    invoke: (input: any, options?: any) => serialize(() => withRetry(() => (base as any).invoke(input, options), {}))
  } as any;
}
