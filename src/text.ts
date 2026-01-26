export function normalizeDateToISO(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return toISO(m[1], m[2], m[3]);

  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return toISO(m[1], m[2], m[3]);

  m = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日$/);
  if (m) return toISO(m[1], m[2], m[3]);

  return null;
}

export function extractISODateFromQuery(query: string): string | null {
  const q = query ?? "";

  let m = q.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) return toISO(m[1], m[2], m[3]);

  m = q.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return toISO(m[1], m[2], m[3]);

  m = q.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return toISO(m[1], m[2], m[3]);

  return null;
}

function toISO(yyyy: string, mm: string, dd: string): string | null {
  const y = Number(yyyy);
  const m = Number(mm);
  const d = Number(dd);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
