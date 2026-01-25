import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { getRagDataDir, getRagItemsPath } from './paths.js';
import type { RagItem, RagItemCreateInput, RagItemUpdateInput } from './types.js';

async function ensureDataDir() {
  await fs.mkdir(getRagDataDir(), { recursive: true });
}

async function readItemsFile(): Promise<RagItem[]> {
  const filePath = getRagItemsPath();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RagItem[];
  } catch (err: any) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

let writeQueue: Promise<void> = Promise.resolve();

async function writeItemsFile(items: RagItem[]): Promise<void> {
  await ensureDataDir();
  const filePath = getRagItemsPath();
  const dir = path.dirname(filePath);
  const tmpPath = path.join(
    dir,
    `${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const json = JSON.stringify(items, null, 2);
  await fs.writeFile(tmpPath, json, 'utf8');
  await fs.rename(tmpPath, filePath);
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function listRagItems(): Promise<RagItem[]> {
  const items = await readItemsFile();
  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

export async function getRagItem(id: string): Promise<RagItem | undefined> {
  const items = await readItemsFile();
  return items.find((x) => x.id === id);
}

export async function createRagItem(input: RagItemCreateInput): Promise<RagItem> {
  if (!input.title?.trim()) throw new Error('title is required');
  if (!input.content?.trim()) throw new Error('content is required');

  const item: RagItem = {
    id: randomUUID(),
    title: input.title.trim(),
    content: input.content,
    source: input.source?.trim() || undefined,
    tags: input.tags?.filter(Boolean).map((t) => t.trim()).filter(Boolean),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await (writeQueue = writeQueue.then(async () => {
    const items = await readItemsFile();
    items.push(item);
    await writeItemsFile(items);
  }));

  return item;
}

export async function updateRagItem(id: string, patch: RagItemUpdateInput): Promise<RagItem> {
  if (!id) throw new Error('id is required');

  let updated: RagItem | undefined;
  await (writeQueue = writeQueue.then(async () => {
    const items = await readItemsFile();
    const idx = items.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error('not_found');

    const current = items[idx];
    const next: RagItem = {
      ...current,
      title: patch.title !== undefined ? patch.title.trim() : current.title,
      content: patch.content !== undefined ? patch.content : current.content,
      source: patch.source !== undefined ? patch.source.trim() || undefined : current.source,
      tags:
        patch.tags !== undefined
          ? patch.tags?.filter(Boolean).map((t) => t.trim()).filter(Boolean)
          : current.tags,
      updatedAt: nowIso()
    };

    if (!next.title?.trim()) throw new Error('title is required');
    if (!next.content?.trim()) throw new Error('content is required');

    items[idx] = next;
    updated = next;
    await writeItemsFile(items);
  }));

  return updated!;
}

export async function deleteRagItem(id: string): Promise<{ deleted: boolean }>
{
  if (!id) throw new Error('id is required');

  let deleted = false;
  await (writeQueue = writeQueue.then(async () => {
    const items = await readItemsFile();
    const next = items.filter((x) => x.id !== id);
    deleted = next.length !== items.length;
    await writeItemsFile(next);
  }));

  return { deleted };
}
