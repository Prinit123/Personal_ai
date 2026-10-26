// src/db.ts — Built-in SQLite database initializer (zero native DLL dependencies, 100% portable)
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'nilesh.db');

export const db = new DatabaseSync(DB_PATH);

// WAL mode and foreign keys
try {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);
} catch {}

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT 'New Chat',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    project_id  TEXT,
    model       TEXT,
    provider    TEXT DEFAULT 'ollama'
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK(role IN ('user','assistant','system','error')),
    content         TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    search_results  TEXT,
    tokens_used     INTEGER DEFAULT 0,
    attachments     TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS knowledge_sources (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK(type IN ('file','url','note')),
    path        TEXT,
    url         TEXT,
    content     TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    tags        TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS agent_actions (
    id          TEXT PRIMARY KEY,
    project_id  TEXT,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  INTEGER NOT NULL,
    approved    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS saved_templates (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL,
    recipient   TEXT,
    tone        TEXT,
    content     TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS file_operations (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    name        TEXT NOT NULL,
    target_path TEXT NOT NULL,
    file_count  INTEGER DEFAULT 1,
    size_bytes  INTEGER DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'verified',
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS temporary_memories (
    id          TEXT PRIMARY KEY,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    category    TEXT DEFAULT 'general',
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS response_cache (
    id               TEXT PRIMARY KEY,
    normalized_query TEXT NOT NULL,
    response_content TEXT NOT NULL,
    provider         TEXT NOT NULL,
    model            TEXT NOT NULL,
    tokens_used      INTEGER DEFAULT 0,
    created_at       INTEGER NOT NULL,
    expires_at       INTEGER NOT NULL,
    hit_count        INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
  CREATE INDEX IF NOT EXISTS idx_templates_cat ON saved_templates(category);
  CREATE INDEX IF NOT EXISTS idx_file_ops_created ON file_operations(created_at);
  CREATE INDEX IF NOT EXISTS idx_memories_expires ON temporary_memories(expires_at);
  CREATE INDEX IF NOT EXISTS idx_cache_query ON response_cache(normalized_query);
  CREATE INDEX IF NOT EXISTS idx_cache_expires ON response_cache(expires_at);
`);

try {
  db.exec("ALTER TABLE messages ADD COLUMN attachments TEXT DEFAULT '[]'");
} catch {}

// ─── Default settings ─────────────────────────────────────────────────────────

const defaults: Record<string, string> = {
  ai_provider:          'ollama',
  ai_model:             'qwen2.5-coder:1.5b',
  theme:                'dark',
  explanation_level:    'beginner',
  web_search_enabled:   'false',
  search_provider:      'brave',
  downloads_org_mode:   'organized',
  auto_save_enabled:    'true',
  save_to_downloads:    'true',
  // Hybrid AI & Performance Settings
  online_enabled:       'true',
  local_smart_routing:  'true',
  ollama_keep_alive:    '10m',
  ollama_num_predict:   '512',
  ollama_num_ctx:       '2048',
  max_local_history:    '6',
  // Temporary Memory & Cache Settings
  memory_enabled:       'true',
  memory_ttl_days:      '7',
  cache_enabled:        'true',
  cache_ttl_days:       '7',
  project_rag_enabled:  'true',
};

const insertDefault = db.prepare(
  `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
);

for (const [k, v] of Object.entries(defaults)) {
  insertDefault.run(k, v);
}

// ─── Settings Helper Functions ────────────────────────────────────────────────

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ─── Temporary Memory & Cache Helper Functions ────────────────────────────────

export function cleanExpiredData(): { deletedMemories: number; deletedCache: number } {
  const now = Date.now();
  const memRes = db.prepare('DELETE FROM temporary_memories WHERE expires_at < ?').run(now);
  const cacheRes = db.prepare('DELETE FROM response_cache WHERE expires_at < ?').run(now);
  return {
    deletedMemories: Number(memRes.changes ?? 0),
    deletedCache: Number(cacheRes.changes ?? 0),
  };
}

// Run initial expiration cleanup
cleanExpiredData();

export interface TemporaryMemory {
  id: string;
  key: string;
  value: string;
  category: string;
  created_at: number;
  expires_at: number;
}

export function getActiveMemories(category?: string): TemporaryMemory[] {
  cleanExpiredData();
  const now = Date.now();
  if (category) {
    return db.prepare('SELECT * FROM temporary_memories WHERE expires_at >= ? AND category = ? ORDER BY created_at DESC').all(now, category) as any[];
  }
  return db.prepare('SELECT * FROM temporary_memories WHERE expires_at >= ? ORDER BY created_at DESC').all(now) as any[];
}

export function isSensitiveMemory(text: string): boolean {
  if (!text) return false;
  const sensitivePatterns = [
    /AIza[0-9A-Za-z-_]{35}/i,
    /sk-[a-zA-Z0-9]{20,}/i,
    /ghp_[a-zA-Z0-9]{36}/i,
    /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i,
    /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    /\b(password|passwd|api_key|secret_key|private_key)\s*[:=]\s*\S+/i,
  ];
  return sensitivePatterns.some(p => p.test(text));
}

export function saveMemory(key: string, value: string, category = 'general', ttlDays = 7): string | null {
  cleanExpiredData();

  // Strict Phase 4 requirement: Never save passwords, API keys or secret credentials
  if (isSensitiveMemory(key) || isSensitiveMemory(value)) {
    console.warn(`[Memory Security] Rejected attempt to store sensitive credentials in temporary memory.`);
    return null;
  }

  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const now = Date.now();
  const expiresAt = now + (ttlDays * 24 * 60 * 60 * 1000);

  // Avoid duplicate key in same category
  const existing = db.prepare('SELECT id FROM temporary_memories WHERE key = ? AND category = ?').get(key, category) as any;
  if (existing) {
    db.prepare('UPDATE temporary_memories SET value = ?, expires_at = ? WHERE id = ?').run(value, expiresAt, existing.id);
    return existing.id;
  }

  db.prepare(`
    INSERT INTO temporary_memories (id, key, value, category, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, key, value, category, now, expiresAt);
  return id;
}

export function deleteMemory(id: string): boolean {
  const res = db.prepare('DELETE FROM temporary_memories WHERE id = ?').run(id);
  return Number(res.changes ?? 0) > 0;
}

export function clearAllMemories(): number {
  const res = db.prepare('DELETE FROM temporary_memories').run();
  return Number(res.changes ?? 0);
}

// ─── Question Cache Helpers ───────────────────────────────────────────────────

export interface CachedResponse {
  id: string;
  normalized_query: string;
  response_content: string;
  provider: string;
  model: string;
  tokens_used: number;
  created_at: number;
  expires_at: number;
  hit_count: number;
}

export function computeCacheId(normalizedQuery: string, provider: string, model: string): string {
  // Deterministic identifier
  const cleanQ = normalizedQuery.trim().toLowerCase();
  const cleanP = provider.trim().toLowerCase();
  const cleanM = model.trim().toLowerCase();
  return `${cleanP}_${cleanM}_${Buffer.from(cleanQ).toString('base64').slice(0, 48)}`;
}

export function getCachedResponse(
  arg1: string,
  arg2: string,
  arg3: string
): (CachedResponse & { answer: string }) | null {
  cleanExpiredData();
  let provider = '';
  let model = '';
  let query = '';

  if (['ollama', 'gemini', 'auto', 'openai', 'groq'].includes((arg1 || '').toLowerCase())) {
    provider = arg1;
    model = arg2;
    query = arg3;
  } else {
    query = arg1;
    provider = arg2;
    model = arg3;
  }

  const cacheId = computeCacheId(query, provider, model);
  const now = Date.now();

  const row = db.prepare('SELECT * FROM response_cache WHERE id = ? AND expires_at >= ?').get(cacheId, now) as CachedResponse | undefined;
  if (row) {
    db.prepare('UPDATE response_cache SET hit_count = hit_count + 1 WHERE id = ?').run(cacheId);
    return {
      ...row,
      answer: row.response_content,
    };
  }
  return null;
}

export function setCachedResponse(
  arg1: string,
  arg2: string,
  arg3: string,
  arg4: string,
  tokensUsed = 0,
  ttlDays = 7
): void {
  cleanExpiredData();
  let provider = '';
  let model = '';
  let query = '';
  let responseContent = '';

  if (['ollama', 'gemini', 'auto', 'openai', 'groq'].includes((arg1 || '').toLowerCase())) {
    provider = arg1;
    model = arg2;
    query = arg3;
    responseContent = arg4;
  } else {
    query = arg1;
    responseContent = arg2;
    provider = arg3;
    model = arg4;
  }

  const cacheId = computeCacheId(query, provider, model);
  const now = Date.now();
  const expiresAt = now + (ttlDays * 24 * 60 * 60 * 1000);

  db.prepare(`
    INSERT OR REPLACE INTO response_cache (id, normalized_query, response_content, provider, model, tokens_used, created_at, expires_at, hit_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT hit_count FROM response_cache WHERE id = ?), 0))
  `).run(cacheId, (query || '').trim().toLowerCase(), responseContent, provider, model, tokensUsed, now, expiresAt, cacheId);
}

export function clearResponseCache(): number {
  const res = db.prepare('DELETE FROM response_cache').run();
  return Number(res.changes ?? 0);
}

export function getCacheStats(): { count: number; totalHits: number } {
  cleanExpiredData();
  const countRow = db.prepare('SELECT count(*) as count FROM response_cache').get() as { count: number };
  const hitsRow = db.prepare('SELECT SUM(hit_count) as totalHits FROM response_cache').get() as { totalHits: number | null };
  return {
    count: countRow.count || 0,
    totalHits: hitsRow.totalHits || 0,
  };
}

console.log(`[DB] Built-in SQLite ready at ${DB_PATH}`);
