import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

import { serialize, withRetry } from './retry.js';

export type LlmProvider = 'gemini';

export function getChatModel() {
  const provider = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();

  if (provider === 'gemini' || provider === 'google' || provider === 'google-genai') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing env var: GEMINI_API_KEY (required for LLM_PROVIDER=gemini)');

    // Model name examples: gemini-1.5-flash, gemini-1.5-pro
    const model = process.env.GEMINI_CHAT_MODEL ?? 'gemini-1.5-flash';

    const base = new ChatGoogleGenerativeAI({
      apiKey,
      model,
      temperature: 0.2
    });

    return {
      invoke: (input: any, options?: any) => serialize(() => withRetry(() => (base as any).invoke(input, options), {}))
    } as any;
  }

  throw new Error(`Unsupported LLM_PROVIDER: ${provider}. Set LLM_PROVIDER=gemini`);
}
