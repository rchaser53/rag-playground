export function indexHtml(): string {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>作業ログRAG</title>
    <style>
      :root { --bg:#0b1220; --muted:#8aa0c8; --text:#e8f0ff; --danger:#ff6b6b; --border:rgba(255,255,255,.08); }
      body{ margin:0; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:radial-gradient(1200px 600px at 20% 0%, #17274a 0%, var(--bg) 55%); color:var(--text); }
      .wrap{ max-width:980px; margin:0 auto; padding:28px 16px 60px; }
      header{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:16px; }
      h1{ font-size:20px; margin:0; letter-spacing:.2px; }
      .sub{ color:var(--muted); font-size:12px; }
      .grid{ display:grid; grid-template-columns:1fr; gap:14px; }
      @media (min-width:900px){ .grid{ grid-template-columns:1fr 1fr; } }
      .card{ background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)); border:1px solid var(--border); border-radius:14px; padding:14px; box-shadow:0 10px 30px rgba(0,0,0,.25); }
      .card h2{ margin:0 0 10px; font-size:14px; color:#cfe0ff; }
      label{ display:block; font-size:12px; color:var(--muted); margin:10px 0 6px; }
      input,textarea{ width:100%; border-radius:10px; border:1px solid var(--border); background:rgba(0,0,0,.25); color:var(--text); padding:10px; outline:none; }
      textarea{ min-height:120px; resize:vertical; }
      .row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      button{ background:rgba(122,162,255,.15); border:1px solid rgba(122,162,255,.35); color:var(--text); padding:10px 12px; border-radius:12px; cursor:pointer; font-weight:600; }
      button:hover{ background:rgba(122,162,255,.22); }
      .danger{ border-color:rgba(255,107,107,.4); background:rgba(255,107,107,.12); }
      .out{ white-space:pre-wrap; background:rgba(0,0,0,.25); border:1px solid var(--border); border-radius:12px; padding:10px; min-height:80px; }
      .small{ font-size:12px; color:var(--muted); }
      .pill{ display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; border:1px solid var(--border); color:var(--muted); font-size:11px; }
      .list{ display:grid; gap:10px; margin-top:10px; }
      .item{ padding:10px; border-radius:12px; border:1px solid var(--border); background:rgba(0,0,0,.20); }
      .item .meta{ display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
      .item .date{ color:#cfe0ff; font-weight:700; font-size:12px; }
      .item .title{ color:var(--text); font-weight:600; font-size:12px; }
      .item .score{ color:var(--muted); font-size:11px; }
      .item .content{ margin-top:6px; color:#c9d8ff; font-size:12px; white-space:pre-wrap; }
      .toast{ margin-top:8px; font-size:12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div>
          <h1>作業ログRAG</h1>
          <div class="sub">保存したログから「いつ何をやったか？」を検索して回答</div>
        </div>
        <div class="pill" id="statusPill">API: checking...</div>
      </header>
      <div class="grid">
        <section class="card">
          <h2>記録する</h2>
          <label>日付</label>
          <input id="date" placeholder="2026-01-25" />
          <div class="small">例: 2026/01/25 や 2026年1月25日 もOK</div>
          <label>タイトル</label>
          <input id="title" placeholder="例: RAGのGUI作成" />
          <label>詳細</label>
          <textarea id="content" placeholder="何をやったか、メモ、リンク、TODOなど"></textarea>
          <div class="row" style="margin-top:10px">
            <button id="saveBtn">保存</button>
            <button id="sampleBtn" class="danger">サンプル投入</button>
            <div class="toast" id="saveToast"></div>
          </div>
        </section>
        <section class="card">
          <h2>問い合わせ</h2>
          <label>質問</label>
          <input id="q" placeholder="2026/01/25に何をやった？" />
          <div class="row" style="margin-top:10px">
            <button id="askBtn">聞く</button>
            <span class="small">上位K件をRAGに使用</span>
          </div>
          <label>回答</label>
          <div class="out" id="answer"></div>
          <div class="small" id="debug"></div>
          <label style="margin-top:12px">参照ログ</label>
          <div class="list" id="hits"></div>
        </section>
      </div>
    </div>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}

export function appJs(): string {
  return `const $=(id)=>document.getElementById(id);
function isoToday(){const d=new Date();const yyyy=d.getFullYear();const mm=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");return \`\${yyyy}-\${mm}-\${dd}\`;}
$("date").value=isoToday();
async function api(path,body){const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const json=await res.json().catch(()=>({}));if(!res.ok) throw new Error(json?.error||\`HTTP \${res.status}\`);return json;}
function escapeHtml(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");}
function renderHits(hits){const el=$("hits");el.innerHTML="";for(const h of (hits||[])){const item=document.createElement("div");item.className="item";item.innerHTML=\`<div class=\\"meta\\"><div class=\\"date\\">\${escapeHtml(h.date||"")}</div><div class=\\"title\\">\${escapeHtml(h.title||"")}</div><div class=\\"score\\">score: \${Number(h.score??0).toFixed(3)}</div></div><div class=\\"content\\">\${escapeHtml(h.content||"")}</div>\`;el.appendChild(item);}}
$("saveBtn").addEventListener("click",async()=>{$("saveToast").textContent="保存中...";try{const out=await api("/api/entries",{date:$("date").value,title:$("title").value,content:$("content").value});$("saveToast").textContent=\`保存しました (id=\${out.id})\`;}catch(e){$("saveToast").textContent=\`失敗: \${e.message}\`;}});
$("sampleBtn").addEventListener("click",async()=>{$("saveToast").textContent="サンプル投入中...";try{const today=isoToday();const samples=[{date:today,title:"RAGアプリの設計",content:"SQLiteで永続化し、埋め込みで検索→LLMで回答する構成を検討した。"},{date:today,title:"GUIを実装",content:"ブラウザGUIから記録と問い合わせができる画面を作った。"},{date:"2025-12-30",title:"依存関係の整理",content:"Node/TS, express, better-sqlite3, Gemini API を採用。"}];for(const s of samples){await api("/api/entries",s);}$("saveToast").textContent="サンプル投入完了";}catch(e){$("saveToast").textContent=\`失敗: \${e.message}\`;}});
$("askBtn").addEventListener("click",async()=>{$("answer").textContent="問い合わせ中...";$("debug").textContent="";try{const out=await api("/api/query",{query:$("q").value,topK:6});$("answer").textContent=out.answer||"";$("debug").textContent=out.note||"";renderHits(out.hits);}catch(e){$("answer").textContent=\`失敗: \${e.message}\`;}});
async function refreshStatus(){
  try{
    const res=await fetch("/api/status");
    const j=await res.json();
    const llm=j.llmProvider||"?";
    const emb=j.embeddingsProvider||"?";
    const llmOn=Boolean(j.llmEnabled);
    const embOn=Boolean(j.embeddingsEnabled);
    $("statusPill").textContent=
      "LLM: "+llm+" "+(llmOn?"on":"off")+" | Emb: "+emb+" "+(embOn?"on":"off");
  }catch{
    $("statusPill").textContent="API: unknown";
  }
}
refreshStatus();
`;
}
