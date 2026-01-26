# rag-playground

作業ログを **SQLite に保存**し、**埋め込み検索 + LLM** で「いつ何をやった？」に答えるミニ RAG アプリです。
Express サーバーがブラウザ UI を配信し、`/api/entries` でログ登録、`/api/query` で問い合わせできます。

## 画面

- ルート `/` に簡易 UI（記録 / 問い合わせ）があります

## 必要要件

- Node.js（推奨: 18+）

## セットアップ

~~~bash
npm install
cp .env.example .env
~~~

`.env` を編集して最低限 `OPENAI_API_KEY` を設定します。

## 起動

### 開発

~~~bash
npm run dev
~~~

起動後、ブラウザで `http://localhost:8787` を開きます（ポートは `PORT` で変更可能）。

### ビルドして起動

~~~bash
npm run build
npm run start
~~~

## 使い方

1. 画面の「記録する」で `日付 / タイトル / 詳細` を入力して保存
2. 「問い合わせ」で質問（例: `2026/01/25に何をやった？`）を入力して実行

`OPENAI_API_KEY` が未設定でも動作しますが、その場合は埋め込み検索と LLM 回答が無効になり、登録済みログから簡易的に返します。

## API

### GET `/api/status`

OpenAI の利用可否を返します。

レスポンス例:

~~~json
{ "openaiEnabled": true }
~~~

### POST `/api/entries`

ログを登録します。

リクエスト例:

~~~json
{ "date": "2026-01-25", "title": "RAGのGUI作成", "content": "..." }
~~~

レスポンス例:

~~~json
{ "id": 1, "date": "2026-01-25", "embedded": true }
~~~

### POST `/api/query`

問い合わせを実行します。

リクエスト例:

~~~json
{ "query": "2026/01/25に何をやった？", "topK": 6 }
~~~

レスポンスには `answer`（回答）, `hits`（参照ログ）, `note`（デバッグ用メモ）が含まれます。

## 環境変数

主要なもの:

- `OPENAI_API_KEY`（必須: OpenAI を使う場合）
- `OPENAI_EMBED_MODEL`（任意, 既定: `text-embedding-3-small`）
- `OPENAI_CHAT_MODEL`（任意, 既定: `gpt-4o-mini`）
- `PORT`（任意, 既定: `8787`）
- `DATA_DIR`（任意, 既定: `./data`）

## データ保存

- 既定では `./data` 配下に SQLite DB を作成します
- `DATA_DIR` を変えると保存先を変更できます

## 補足

- docker-compose.yml は Chroma 用の雛形です（現状の実装は SQLite を使用しており、Chroma には接続しません）。