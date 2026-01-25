import http from 'node:http';
import { URL } from 'node:url';

import { createRagItem, deleteRagItem, listRagItems, updateRagItem } from '../rag/store.js';
import { reindexAllRagItems } from '../rag/indexer.js';

const PORT = Number(process.env.ADMIN_PORT ?? '3001');

function sendJson(res: http.ServerResponse, status: number, body: any) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(json);
}

function sendText(res: http.ServerResponse, status: number, body: string, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store'
  });
  res.end(body);
}

async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function uiHtml() {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RAG Admin</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; }
      .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      textarea { width: 100%; min-height: 140px; }
      input[type=text] { width: 340px; max-width: 90vw; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border-bottom: 1px solid rgba(127,127,127,.35); padding: 10px; vertical-align: top; }
      th { text-align: left; }
      button { cursor: pointer; }
      .muted { opacity: .75; font-size: 12px; }
      .danger { color: #b00020; }
      .card { border: 1px solid rgba(127,127,127,.35); border-radius: 12px; padding: 14px; }
      .right { margin-left: auto; }
    </style>
  </head>
  <body>
    <div class="row">
      <h1 style="margin: 0">RAG Admin</h1>
      <div class="right row">
        <button id="reload">再読み込み</button>
        <button id="reindex">Chromaへ再インデックス</button>
      </div>
    </div>
    <p class="muted">保存先: <code>data/rag/items.json</code>（環境変数 <code>RAG_DATA_DIR</code> で変更可）</p>

    <div class="card" style="margin-top: 12px;">
      <h2 style="margin-top:0">追加 / 更新</h2>
      <div class="row">
        <input id="id" type="text" placeholder="id（更新時のみ）" />
        <input id="title" type="text" placeholder="title" />
        <input id="source" type="text" placeholder="source（任意）" />
        <input id="tags" type="text" placeholder="tags（カンマ区切り、任意）" />
      </div>
      <div style="margin-top: 10px;">
        <textarea id="content" placeholder="content"></textarea>
      </div>
      <div class="row" style="margin-top: 10px;">
        <button id="create">追加</button>
        <button id="update">更新</button>
        <span id="status" class="muted"></span>
      </div>
    </div>

    <div class="card" style="margin-top: 12px;">
      <h2 style="margin-top:0">ファイルから追加</h2>
      <div class="row">
        <input id="file" type="file" multiple accept=".txt,.md,.json,text/plain,text/markdown,application/json" />
        <button id="import">選択したファイルを追加</button>
        <label class="muted" style="display:flex; gap:8px; align-items:center;">
          <input id="autoReindex" type="checkbox" checked />
          インポート後に自動で再インデックス
        </label>
      </div>
      <p class="muted" style="margin-bottom:0">
        .txt/.md は「ファイル内容を content」として追加します（title=ファイル名、source=file:&lt;name&gt;）。
        .json は <code>{ title, content, source?, tags? }</code> またはその配列をインポートできます。
      </p>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 240px;">title</th>
          <th>content</th>
          <th style="width: 240px;">meta</th>
          <th style="width: 160px;">actions</th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>

    <script>
      const el = (id) => document.getElementById(id);
      const statusEl = el('status');
      const setStatus = (t) => { statusEl.textContent = t; };

      function formToPayload() {
        const title = el('title').value;
        const content = el('content').value;
        const source = el('source').value;
        const tagsRaw = el('tags').value;
        const tags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);
        return { title, content, source, tags: tags.length ? tags : undefined };
      }

      function tagsFromForm() {
        const tagsRaw = el('tags').value;
        const tags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);
        return tags.length ? tags : undefined;
      }

      function fillForm(item) {
        el('id').value = item.id;
        el('title').value = item.title || '';
        el('content').value = item.content || '';
        el('source').value = item.source || '';
        el('tags').value = (item.tags || []).join(', ');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      async function api(path, init) {
        const res = await fetch(path, init);
        const txt = await res.text();
        const body = txt ? JSON.parse(txt) : null;
        if (!res.ok) {
          const msg = body?.error || res.statusText;
          throw new Error(msg);
        }
        return body;
      }

      function truncate(s, n) {
        if (!s) return '';
        return s.length > n ? s.slice(0, n) + '…' : s;
      }

      async function load() {
        setStatus('読み込み中…');
        const items = await api('/api/items');
        const tbody = el('rows');
        tbody.innerHTML = '';
        for (const it of items) {
          const tr = document.createElement('tr');
          const safeTitle = (it.title || '').replaceAll('<','&lt;').replaceAll('>','&gt;');
          const safeId = (it.id || '').replaceAll('<','&lt;').replaceAll('>','&gt;');
          const safeContent = truncate(it.content, 600).replaceAll('<','&lt;').replaceAll('>','&gt;');
          const safeSource = (it.source ? String(it.source) : '-').replaceAll('<','&lt;').replaceAll('>','&gt;');
          const safeTags = ((it.tags || []).join(', ') || '-').replaceAll('<','&lt;').replaceAll('>','&gt;');
          const safeUpdated = (it.updatedAt || '').replaceAll('<','&lt;').replaceAll('>','&gt;');
          tr.innerHTML =
            '<td><div><strong>' + safeTitle + '</strong></div><div class="muted">' + safeId + '</div></td>' +
            '<td><div>' + safeContent + '</div></td>' +
            '<td class="muted">' +
              '<div>source: ' + safeSource + '</div>' +
              '<div>tags: ' + safeTags + '</div>' +
              '<div>updated: ' + safeUpdated + '</div>' +
            '</td>' +
            '<td>' +
              '<div class="row">' +
                '<button data-edit>編集</button>' +
                '<button data-del class="danger">削除</button>' +
              '</div>' +
            '</td>';
          tr.querySelector('[data-edit]').onclick = () => fillForm(it);
          tr.querySelector('[data-del]').onclick = async () => {
            if (!confirm('削除しますか？')) return;
            try {
              await api('/api/items/' + encodeURIComponent(it.id), { method: 'DELETE' });
              await load();
              setStatus('削除しました');
            } catch (e) {
              setStatus('削除失敗: ' + e.message);
            }
          };
          tbody.appendChild(tr);
        }
        setStatus('OK');
      }

      el('reload').onclick = () => load().catch(e => setStatus('読み込み失敗: ' + e.message));

      el('create').onclick = async () => {
        try {
          setStatus('追加中…');
          await api('/api/items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(formToPayload()) });
          await load();
          setStatus('追加しました');
        } catch (e) {
          setStatus('追加失敗: ' + e.message);
        }
      };

      el('update').onclick = async () => {
        const id = el('id').value.trim();
        if (!id) return setStatus('更新にはidが必要です（一覧の編集ボタンでフォームに入ります）');
        try {
          setStatus('更新中…');
          await api('/api/items/' + encodeURIComponent(id), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(formToPayload()) });
          await load();
          setStatus('更新しました');
        } catch (e) {
          setStatus('更新失敗: ' + e.message);
        }
      };

      el('reindex').onclick = async () => {
        try {
          setStatus('再インデックス中…（Chromaが起動している必要があります）');
          const r = await api('/api/reindex', { method: 'POST' });
          setStatus('完了: items=' + r.items + ', chunks=' + r.chunks);
        } catch (e) {
          setStatus('再インデックス失敗: ' + e.message);
        }
      };

      el('import').onclick = async () => {
        const inputEl = el('file');
        const files = Array.from(inputEl.files || []);
        if (files.length === 0) return setStatus('ファイルを選択してください');

        const defaultTags = tagsFromForm();
        const shouldReindex = !!el('autoReindex').checked;
        let created = 0;

        try {
          setStatus('インポート中…');
          for (const f of files) {
            const text = await f.text();
            const name = f.name || 'uploaded';

            if (name.toLowerCase().endsWith('.json')) {
              let parsed;
              try {
                parsed = JSON.parse(text);
              } catch (e) {
                throw new Error('JSON解析に失敗: ' + name);
              }

              const arr = Array.isArray(parsed) ? parsed : [parsed];
              for (const obj of arr) {
                if (!obj || typeof obj !== 'object') continue;
                const payload = {
                  title: String(obj.title || name),
                  content: String(obj.content || ''),
                  source: obj.source !== undefined ? String(obj.source) : 'file:' + name,
                  tags: Array.isArray(obj.tags) ? obj.tags.map(String) : defaultTags
                };
                if (!payload.content.trim()) continue;
                await api('/api/items', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                created++;
              }
              continue;
            }

            // txt/md/その他はプレーンテキストとして追加
            const payload = {
              title: name,
              content: text,
              source: 'file:' + name,
              tags: defaultTags
            };
            if (!payload.content.trim()) continue;
            await api('/api/items', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload)
            });
            created++;
          }

          await load();
          if (shouldReindex) {
            setStatus('インポート完了: ' + created + '件。再インデックス中…');
            const r = await api('/api/reindex', { method: 'POST' });
            setStatus('インポート完了: ' + created + '件。再インデックス完了: items=' + r.items + ', chunks=' + r.chunks);
          } else {
            setStatus('インポート完了: ' + created + '件');
          }
          inputEl.value = '';
        } catch (e) {
          setStatus('インポート失敗: ' + e.message);
        }
      };

      load().catch(e => setStatus('読み込み失敗: ' + e.message));
    </script>
  </body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (method === 'GET' && url.pathname === '/') {
      return sendText(res, 200, uiHtml(), 'text/html; charset=utf-8');
    }

    if (method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true });
    }

    if (method === 'GET' && url.pathname === '/api/items') {
      const items = await listRagItems();
      return sendJson(res, 200, items);
    }

    if (method === 'POST' && url.pathname === '/api/items') {
      const body = await readJsonBody(req);
      const created = await createRagItem(body);
      return sendJson(res, 201, created);
    }

    const m = url.pathname.match(/^\/api\/items\/(.+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      if (method === 'PUT') {
        const body = await readJsonBody(req);
        const updated = await updateRagItem(id, body);
        return sendJson(res, 200, updated);
      }
      if (method === 'DELETE') {
        const out = await deleteRagItem(id);
        return sendJson(res, 200, out);
      }
    }

    if (method === 'POST' && url.pathname === '/api/reindex') {
      const result = await reindexAllRagItems();
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: 'not_found' });
  } catch (err: any) {
    const msg = typeof err?.message === 'string' ? err.message : 'internal_error';
    const status = msg === 'not_found' ? 404 : 400;
    return sendJson(res, status, { error: msg });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`RAG Admin: http://localhost:${PORT}`);
});
