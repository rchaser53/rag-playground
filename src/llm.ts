import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

import { serialize, withRetry } from './retry.js';

export type LlmProvider = 'gemini';

export function getGeminiChatModelName(): string {
  return process.env.GEMINI_CHAT_MODEL ?? 'gemini-3-pro-preview';
}

export function getChatModel() {
  const provider = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();

  if (provider === 'gemini' || provider === 'google' || provider === 'google-genai') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing env var: GEMINI_API_KEY (required for LLM_PROVIDER=gemini)');

    // Model name examples: gemini-3-pro-preview, gemini-flash-latest
    const model = getGeminiChatModelName();

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
