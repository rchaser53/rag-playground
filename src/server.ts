import "dotenv/config";
import express from "express";
import { z } from "zod";
import { env } from "./env.js";
import { openDb } from "./db.js";
import { createEntry, queryRag } from "./rag.js";
import { appJs, indexHtml } from "./ui.js";
import { embeddingsEnabled, llmEnabled, getRuntimeModelInfo } from "./ai.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const db = openDb(env.dataDir);

app.get("/", (_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(indexHtml());
});

app.get("/app.js", (_req, res) => {
  res.setHeader("content-type", "text/javascript; charset=utf-8");
  res.send(appJs());
});

app.get("/api/status", (_req, res) => {
  const info = getRuntimeModelInfo();
  res.json({
    llmProvider: env.llmProvider,
    embeddingsProvider: env.embeddingsProvider,
    llmEnabled: llmEnabled(),
    embeddingsEnabled: embeddingsEnabled(),
    llmModel: info.llm.model,
    embeddingsModel: info.embeddings.model,
    embeddingsModelKey: info.embeddings.modelKey,
  });
});

app.post("/api/entries", async (req, res) => {
  try {
    const out = await createEntry(db, req.body, env.embeddingsModelKey);
    res.json(out);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "bad request" });
  }
});

app.post("/api/query", async (req, res) => {
  const schema = z.object({
    query: z.string().min(1),
    topK: z.number().int().min(1).max(20).optional(),
  });
  try {
    const { query, topK } = schema.parse(req.body);
    const out = await queryRag(db, {
      query,
      topK: topK ?? 6,
      embedModel: env.embeddingsModelKey,
    });
    res.json({
      ...out,
      model: getRuntimeModelInfo(),
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "bad request" });
  }
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`journal listening on http://localhost:${env.port}`);
});
