import OpenAI from "openai";
import { env } from "./env.js";

export function getOpenAIClient(): OpenAI | null {
  if (!env.openaiApiKey) return null;
  return new OpenAI({ apiKey: env.openaiApiKey });
}

export async function embedText(input: string): Promise<number[] | null> {
  const client = getOpenAIClient();
  if (!client) return null;
  const res = await client.embeddings.create({
    model: env.openaiEmbedModel,
    input,
  });
  const v = res.data?.[0]?.embedding;
  return Array.isArray(v) ? (v as number[]) : null;
}

export async function answerWithContext(args: {
  question: string;
  dateFilterISO: string | null;
  contexts: Array<{ date: string; title: string; content: string }>;
}): Promise<string | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  const ctx = args.contexts
    .map(
      (c, i) =>
        `# ログ${i + 1}\n日付: ${c.date}\nタイトル: ${c.title}\n内容:\n${c.content}`
    )
    .join("\n\n");

  const sys =
    "あなたは個人の作業ログ(日本語)を参照して質問に答えるアシスタントです。" +
    " 推測で事実を作らず、ログにないことは『不明』と明示してください。";

  const user =
    `質問: ${args.question}\n` +
    (args.dateFilterISO
      ? `\n指定日(ISO): ${args.dateFilterISO}\nこの日付のログを優先して、何をやったかを箇条書きで簡潔にまとめてください。\n`
      : "\n関連するログを根拠に、要点を箇条書きでまとめ、最後に短い結論を1-2文で書いてください。\n") +
    `\n参照ログ:\n${ctx}`;

  const res = await client.chat.completions.create({
    model: env.openaiChatModel,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.2,
  });

  return res.choices?.[0]?.message?.content ?? null;
}
