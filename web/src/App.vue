<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type StatusResponse = {
  llmProvider?: string
  embeddingsProvider?: string
  llmEnabled?: boolean
  embeddingsEnabled?: boolean
}

type EntryInput = {
  date: string
  title: string
  content: string
}

type EntryResponse = {
  id: number
}

type QueryHit = {
  id?: number
  date?: string
  title?: string
  content?: string
  score?: number
}

type QueryResponse = {
  answer?: string
  note?: string
  hits?: QueryHit[]
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`)
  return json as T
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as any)?.error || `HTTP ${res.status}`)
  return json as T
}

function isoToday(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const date = ref(isoToday())
const title = ref('')
const content = ref('')
const saveToast = ref('')
const saving = ref(false)

const query = ref('')
const asking = ref(false)
const answer = ref('')
const note = ref('')
const hits = ref<QueryHit[]>([])

const statusText = ref('API: checking...')
const statusOk = ref<boolean | null>(null)

const topK = 6
const CONTENT_MAX = 400

const contentRemaining = computed(() => Math.max(0, CONTENT_MAX - content.value.length))

const statusClass = computed(() => {
  if (statusOk.value === false) return 'pill pillDanger'
  return 'pill'
})

async function refreshStatus() {
  try {
    const j = await getJson<StatusResponse>('/api/status')
    const llm = j.llmProvider || '?'
    const emb = j.embeddingsProvider || '?'
    const llmOn = Boolean(j.llmEnabled)
    const embOn = Boolean(j.embeddingsEnabled)
    statusText.value = `LLM: ${llm} ${llmOn ? 'on' : 'off'} | Emb: ${emb} ${embOn ? 'on' : 'off'}`
    statusOk.value = true
  } catch {
    statusText.value = 'API: unknown'
    statusOk.value = false
  }
}

async function saveEntry() {
  if (content.value.length > CONTENT_MAX) {
    saveToast.value = `失敗: 詳細は${CONTENT_MAX}文字以内で入力してください`
    return
  }
  saveToast.value = '保存中...'
  saving.value = true
  try {
    const out = await postJson<EntryResponse>('/api/entries', {
      date: date.value,
      title: title.value,
      content: content.value,
    } satisfies EntryInput)
    saveToast.value = `保存しました (id=${out.id})`
  } catch (e: any) {
    saveToast.value = `失敗: ${e?.message ?? 'unknown error'}`
  } finally {
    saving.value = false
  }
}

async function insertSamples() {
  saveToast.value = 'サンプル投入中...'
  saving.value = true
  try {
    const today = isoToday()
    const samples: EntryInput[] = [
      { date: today, title: 'RAGアプリの設計', content: 'SQLiteで永続化し、埋め込みで検索→LLMで回答する構成を検討した。' },
      { date: today, title: 'GUIを実装', content: 'ブラウザGUIから記録と問い合わせができる画面を作った。' },
      { date: '2025-12-30', title: '依存関係の整理', content: 'Node/TS, express, better-sqlite3, Gemini API を採用。' },
    ]
    for (const s of samples) await postJson<EntryResponse>('/api/entries', s)
    saveToast.value = 'サンプル投入完了'
  } catch (e: any) {
    saveToast.value = `失敗: ${e?.message ?? 'unknown error'}`
  } finally {
    saving.value = false
  }
}

async function ask() {
  answer.value = '問い合わせ中...'
  note.value = ''
  hits.value = []
  asking.value = true
  try {
    const out = await postJson<QueryResponse>('/api/query', { query: query.value, topK })
    answer.value = out.answer || ''
    note.value = out.note || ''
    hits.value = out.hits || []
  } catch (e: any) {
    answer.value = `失敗: ${e?.message ?? 'unknown error'}`
  } finally {
    asking.value = false
  }
}

onMounted(() => {
  refreshStatus()
})
</script>

<template>
  <div class="wrap">
    <header>
      <div>
        <h1>作業ログRAG</h1>
        <div class="sub">保存したログから「いつ何をやったか？」を検索して回答</div>
      </div>
      <div :class="statusClass">{{ statusText }}</div>
    </header>

    <div class="grid">
      <section class="card">
        <h2>記録する</h2>

        <label>日付</label>
        <input v-model="date" type="date" required />
        <div class="small">カレンダーから選択（形式: YYYY-MM-DD）</div>

        <label>タイトル</label>
        <input v-model="title" placeholder="例: RAGのGUI作成" />

        <label>詳細</label>
        <textarea
          v-model="content"
          :maxlength="CONTENT_MAX"
          placeholder="何をやったか、メモ、リンク、TODOなど"
        />
        <div class="small">残り{{ contentRemaining }}文字</div>

        <div class="row" style="margin-top: 10px">
          <button :disabled="saving" @click="saveEntry">保存</button>
          <button class="danger" :disabled="saving" @click="insertSamples">サンプル投入</button>
          <div class="toast">{{ saveToast }}</div>
        </div>
      </section>

      <section class="card">
        <h2>問い合わせ</h2>

        <label>質問</label>
        <input v-model="query" placeholder="2026/01/25に何をやった？" />

        <div class="row" style="margin-top: 10px">
          <button :disabled="asking" @click="ask">聞く</button>
          <span class="small">上位{{ topK }}件をRAGに使用</span>
        </div>

        <label>回答</label>
        <div class="out">{{ answer }}</div>
        <div class="small">{{ note }}</div>

        <label style="margin-top: 12px">参照ログ</label>
        <div class="list">
          <div v-for="(h, i) in hits" :key="h.id ?? i" class="item">
            <div class="meta">
              <div class="date">{{ h.date || '' }}</div>
              <div class="title">{{ h.title || '' }}</div>
              <div class="score">score: {{ Number(h.score ?? 0).toFixed(3) }}</div>
            </div>
            <div class="content">{{ h.content || '' }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
