# トラブルシュート

## まず確認すること（共通）

- `npm run chroma:up` を実行済みか
- `.env` の `CHROMA_URL` が `http://localhost:8000` になっているか
- `data/shikiho/raw/` に `.txt` / `.md` が入っているか

## よくあるエラー

### `No documents found`

- `data/shikiho/raw/` にファイルが入っているか確認してください。
- 取り込みを再実行します: `npm run dev:ingest`

### Chromaに接続できない

- `npm run chroma:up` 実行後、`CHROMA_URL` が `http://localhost:8000` か確認してください。
- Docker Desktop が起動しているか確認してください。

### Geminiが認証エラーになる

- `.env` に `GEMINI_API_KEY` が設定されているか確認してください。
- APIキーが Gemini API（AI Studio/Cloud）のものか確認してください。

### 429（Too Many Requests / RESOURCE_EXHAUSTED）が出る

- `.env` の `REQUEST_SPACING_MS` を増やしてください（例: 1500→5000）
- `.env` の `MAX_RETRIES` を増やしてください（処理時間は伸びます）
- ただし「無料枠が0」「請求設定未完了」等の状態だと、待っても改善しないため AI Studio/Cloud 側の設定が必要です

### 埋め込み（Embeddings）が失敗する

- 一時的なレート制限/利用枠の可能性があります（上記 429 を参照）。
- 外部APIなしで動作確認したい場合は `EMBEDDINGS_PROVIDER=localhash` に切り替えてください（精度は低いです）。

### `model ... does not exist` / `model_not_found`

- `GEMINI_CHAT_MODEL` / `GEMINI_EMBEDDING_MODEL` を利用可能なモデル名に変更してください。
  - 例: `GEMINI_CHAT_MODEL=gemini-3-pro-preview`
  - 例: `GEMINI_EMBEDDING_MODEL=text-embedding-004`

### `Collection expecting embedding with dimension ...` が出る

- Embeddings の種類/モデルを切り替えたため、既存の Chroma コレクションの次元と一致していません。
- `npm run dev:ingest -- --reset-collection` で対象コレクションを削除→再作成してください（削除された場合はログが出ます）。
