import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function openDb(dataDir: string) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "journal.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);

    CREATE TABLE IF NOT EXISTS embeddings (
      entry_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      vector_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (entry_id, model),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );
  `);
}
