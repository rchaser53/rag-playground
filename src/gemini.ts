import { env } from "./env.js";

type GeminiContentPart = { text?: string };

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiContentPart[];
    };
  }>;
};

type EmbedContentResponse = {
  embedding?: {
    values?: number[];
  };
};

type ListModelsResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
  nextPageToken?: string;
};

function apiBase(version: "v1beta" | "v1"): string {
  return `https://generativelanguage.googleapis.com/${version}/models`;
}

function partsToText(parts: GeminiContentPart[] | undefined): string {
  if (!parts?.length) return "";
  return parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
}

function normalizeModelName(model: string): string {
  const m = (model ?? "").trim();
  return m.startsWith("models/") ? m.slice("models/".length) : m;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini API error (${res.status}): ${txt.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { "content-type": "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini API error (${res.status}): ${txt.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

function uniq<T>(xs: T[]): T[] {
  const out: T[] = [];
  for (const x of xs) if (!out.includes(x)) out.push(x);
  return out;
}

let cachedWorkingEmbeddingModel: string | null = null;

export function getGeminiEmbeddingModelInUse(): string {
  // embedTextGemini() が ListModels 等で別モデルを見つけた場合も、ここで追跡できる
  return normalizeModelName(cachedWorkingEmbeddingModel ?? env.geminiEmbeddingModel);
}

async function listEmbeddingModels(version: "v1beta" | "v1"): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/${version}/models?key=${encodeURIComponent(
    env.geminiApiKey
  )}`;

  const json = await getJson<ListModelsResponse>(url);
  const models = json.models ?? [];

  const embedModels = models
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("embedContent"))
    .map((m) => normalizeModelName(m.name ?? ""))
    .filter((name) => Boolean(name));

  return uniq(embedModels);
}

async function tryEmbedContent(model: string, version: "v1beta" | "v1", input: string) {
  const url = `${apiBase(version)}/${encodeURIComponent(
    normalizeModelName(model)
  )}:embedContent?key=${encodeURIComponent(
    env.geminiApiKey
  )}`;

  const body = {
    content: {
      parts: [{ text: input }],
    },
  };

  return await postJson<EmbedContentResponse>(url, body);
}

export async function embedTextGemini(input: string): Promise<number[] | null> {
  if (!env.geminiApiKey) return null;

  const configured = normalizeModelName(env.geminiEmbeddingModel);
  const initialCandidates = uniq(
    [cachedWorkingEmbeddingModel, configured].filter((x): x is string => Boolean(x))
  );

  const versions: Array<"v1beta" | "v1"> = ["v1beta", "v1"];

  // まずは設定値/キャッシュを v1beta → v1 で試す
  for (const version of versions) {
    for (const m of initialCandidates) {
      try {
        const json = await tryEmbedContent(m, version, input);
        const v = json.embedding?.values;
        if (Array.isArray(v) && v.length > 0) {
          cachedWorkingEmbeddingModel = m;
          return v;
        }
      } catch (e: any) {
        const msg = String(e?.message ?? "");
        const isNotFound = msg.includes("(404)") || msg.includes("NOT_FOUND");
        if (!isNotFound) throw e;
      }
    }
  }

  // 次に、ListModelsからembedContent対応モデルを探して試す
  const discovered: string[] = [];
  for (const version of versions) {
    try {
      discovered.push(...(await listEmbeddingModels(version)));
    } catch {
      // ListModelsが使えない権限/設定でも、後続の診断メッセージに回す
    }
  }

  const candidates = uniq(discovered);
  for (const version of versions) {
    for (const m of candidates) {
      try {
        const json = await tryEmbedContent(m, version, input);
        const v = json.embedding?.values;
        if (Array.isArray(v) && v.length > 0) {
          cachedWorkingEmbeddingModel = m;
          return v;
        }
      } catch (e: any) {
        const msg = String(e?.message ?? "");
        const isNotFound = msg.includes("(404)") || msg.includes("NOT_FOUND");
        if (!isNotFound) throw e;
      }
    }
  }

  const hint = candidates.length
    ? `利用可能な候補(一部): ${candidates.slice(0, 10).join(", ")}`
    : "ListModelsでembedContent対応モデルを検出できませんでした（API/権限/リージョン設定の可能性）。";

  throw new Error(
    [
      "Geminiの埋め込みモデル呼び出しに失敗しました。",
      `モデル: ${configured}`,
      "試行: 設定値/キャッシュ → ListModels検出 → v1beta/v1",
      hint,
      "対処: Generative Language API が有効か確認し、GEMINI_EMBEDDING_MODEL を候補のモデル名に変更してください。",
    ].join("\n")
  );

}

export async function answerWithContextGemini(args: {
  question: string;
  dateFilterISO: string | null;
  contexts: Array<{ date: string; title: string; content: string }>;
}): Promise<string | null> {
  if (!env.geminiApiKey) return null;
  const model = normalizeModelName(env.geminiChatModel);

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

  const url = `${apiBase("v1beta")}/${encodeURIComponent(
    normalizeModelName(model)
  )}:generateContent?key=${encodeURIComponent(
    env.geminiApiKey
  )}`;

  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { temperature: 0.2 },
  };

  const json = await postJson<GenerateContentResponse>(url, body);
  const text = partsToText(json.candidates?.[0]?.content?.parts);
  return text || null;
}
