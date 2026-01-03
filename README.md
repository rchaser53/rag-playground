# rag-playground (四季報RAG 下準備)

このリポジトリは **LangChain + Node.js + Chroma** で、手元に用意した四季報由来テキストを検索できるRAGの雛形です。

## 重要: 四季報データについて

- 四季報(記事/データ)は一般に著作権・利用規約の対象です。
- この雛形は「あなたが正当に入手・利用権限を持つテキスト/要約/メモ」を投入する前提で、**スクレイピング等の取得処理は含みません**。

## 1) 前提

- Node.js 18+ (推奨 20+)
- Docker Desktop

## 2) セットアップ

```bash
npm install
cp .env.example .env
```

`.env` に Gemini の設定をしてください。

### Gemini

- Google AI Studio等でGemini APIキーを発行して `GEMINI_API_KEY` に設定
- `.env` で以下を設定
  - `LLM_PROVIDER=gemini`
  - `EMBEDDINGS_PROVIDER=gemini`
  - 必要に応じて `GEMINI_CHAT_MODEL` / `GEMINI_EMBEDDING_MODEL` も変更（例: `GEMINI_CHAT_MODEL=gemini-3-pro-preview`）

## 3) Chroma起動

```bash
npm run chroma:up
```

- Chroma: http://localhost:8000

## 4) 四季報テキストを配置

- `data/shikiho/raw/` 配下に `.txt` または `.md` を置きます
  - 例: 銘柄ごとに1ファイル
  - 例: セクターごとにまとめる

## 5) 取り込み(インデックス化)

```bash
npm run dev:ingest
```

## 6) 質問(検索+回答)

```bash
npm run dev:query
```

### ターミナル入力なしで1回だけ実行する（おすすめ）

VS Codeが「ターミナルに必要な入力を指定してください」と出るのは対話モードのためです。
質問を引数で渡すと、ターミナル入力なしで1回で終了します。

```bash
npm run dev:query -- "来期の見通しと主なリスクは？"
# または
npm run dev:query -- --question "来期の見通しと主なリスクは？"
```

終了: `exit` または `終了`

## トラブルシュート

まとまった手順は [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) を参照してください。
