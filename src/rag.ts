import type Database from "better-sqlite3";
import { z } from "zod";
import { embedText, answerWithContext } from "./ai.js";
import { cosineSimilarity, extractISODateFromQuery, normalizeDateToISO } from "./text.js";

type EntryWithEmbeddingRow = {
  id: number;
  date: string;
  title: string;
  content: string;
  vector_json: string | null;
};

type ScoredHit = {
  id: number;
  date: string;
  title: string;
  content: string;
  score: number;
  hasVector: boolean;
};

const createEntrySchema = z.object({
  date: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});

export async function createEntry(db: Database.Database, input: unknown, embedModel: string) {
  const parsed = createEntrySchema.parse(input);
  const dateISO = normalizeDateToISO(parsed.date) ?? parsed.date;

  const insert = db.prepare(
    "INSERT INTO entries(date, title, content) VALUES (@date, @title, @content)"
  );
  const info = insert.run({
    date: dateISO,
    title: parsed.title.trim(),
    content: parsed.content.trim(),
  });
  const id = Number(info.lastInsertRowid);

  const doc = `${dateISO}\n${parsed.title}\n${parsed.content}`;
  const vec = await embedText(doc);
  if (vec) {
    const upsert = db.prepare(
      "INSERT OR REPLACE INTO embeddings(entry_id, model, vector_json) VALUES (@entry_id, @model, @vector_json)"
    );
    upsert.run({ entry_id: id, model: embedModel, vector_json: JSON.stringify(vec) });
  }

  return { id, date: dateISO, embedded: Boolean(vec) };
}

export async function queryRag(
  db: Database.Database,
  args: { query: string; topK: number; embedModel: string }
) {
  const q = (args.query ?? "").trim();
  if (!q) {
    return {
      answer: "質問が空です。例: 2026/01/25に何をやった？",
      hits: [],
      note: "",
    };
  }

  const dateFilterISO = extractISODateFromQuery(q);
  const qVec = await embedText(q);
  const hasEmbeddings = Boolean(qVec);

  const rows = dateFilterISO
    ? db
        .prepare(
          `
          SELECT e.id, e.date, e.title, e.content, em.vector_json
          FROM entries e
          LEFT JOIN embeddings em
            ON em.entry_id = e.id AND em.model = @model
          WHERE e.date = @date
          ORDER BY e.id DESC
        `
        )
        .all({ model: args.embedModel, date: dateFilterISO })
    : db
        .prepare(
          `
          SELECT e.id, e.date, e.title, e.content, em.vector_json
          FROM entries e
          LEFT JOIN embeddings em
            ON em.entry_id = e.id AND em.model = @model
          ORDER BY e.id DESC
        `
        )
        .all({ model: args.embedModel });

  const scored: ScoredHit[] = (rows as EntryWithEmbeddingRow[])
    .map((r) => {
      const vec = r.vector_json ? safeParseVector(r.vector_json) : null;
      const score = qVec && vec ? cosineSimilarity(qVec, vec) : 0;
      return {
        id: r.id,
        date: r.date,
        title: r.title,
        content: r.content,
        score,
        hasVector: Boolean(vec),
      };
    })
    .sort((a, b) => (b.score === a.score ? b.id - a.id : b.score - a.score))
    .slice(0, Math.max(1, Math.min(20, args.topK)));

  const contexts = scored.map((s) => ({ date: s.date, title: s.title, content: s.content }));
  const llm = await answerWithContext({ question: q, dateFilterISO, contexts });

  const noteParts: string[] = [];
  if (!hasEmbeddings) noteParts.push("埋め込み生成が無効です（APIキー未設定など）。");
  if (dateFilterISO) noteParts.push(`日付フィルタ: ${dateFilterISO}`);
  if (scored.some((x) => !x.hasVector)) {
    noteParts.push(
      "一部ログは埋め込み未作成のためスコア0です（設定後に再登録すると改善します）。"
    );
  }

  const fallback = contexts.length
    ? dateFilterISO
      ? contexts
          .map((c) => `- ${c.title}: ${firstLine(c.content)}`)
          .join("\n")
      : contexts.map((c) => `- [${c.date}] ${c.title}`).join("\n")
    : "該当するログが見つかりませんでした。";

  return {
    answer: llm ?? fallback,
    hits: scored.map((s) => ({
      id: s.id,
      date: s.date,
      title: s.title,
      content: s.content,
      score: s.score,
    })),
    note: noteParts.join(" "),
  };
}

function safeParseVector(json: string): number[] | null {
  try {
    const v = JSON.parse(json);
    if (!Array.isArray(v)) return null;
    if (v.length < 8) return null;
    return v.map((x) => Number(x));
  } catch {
    return null;
  }
}

function firstLine(s: string): string {
  const t = (s ?? "").trim();
  const i = t.indexOf("\n");
  return i >= 0 ? t.slice(0, i) : t;
}
