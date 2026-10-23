import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LOCAL_TENANT, validateTenantId } from './tenant-db.mjs';

export function openMemory(file = process.env.JULES_MEMORY_PATH || '.jules-state/memory.sqlite') {
  if (file !== ':memory:') mkdirSync(dirname(resolve(/* turbopackIgnore: true */ file)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file === ':memory:' ? file : resolve(/* turbopackIgnore: true */ file));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, value TEXT NOT NULL,
      source TEXT NOT NULL, confidence REAL NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memory_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, memory_id TEXT NOT NULL,
      prior_value TEXT, next_value TEXT, changed_at TEXT NOT NULL
    );`);
  return db;
}

// Separate SQLite databases give each verified tenant an independent WAL,
// schema and revision history. Never accept a path or tenant from the browser.
export function openMemoryForTenant(verifiedTenantId, file = process.env.JULES_MEMORY_PATH || '.jules-state/memory.sqlite') {
  validateTenantId(verifiedTenantId);
  if (verifiedTenantId === LOCAL_TENANT && process.env.JULES_AUTH_ENABLED !== 'true') return openMemory(file);
  if (file === ':memory:') return openMemory(file); // Tests only: no persisted cross-tenant state.
  return openMemory(resolve(dirname(file), 'tenants', `${verifiedTenantId}.sqlite`));
}

export function validateMemory(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Object required';
  if (typeof input.key !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(input.key)) return 'Invalid memory key';
  if (typeof input.value !== 'string' || !input.value.trim() || input.value.length > 8000) return 'Invalid memory value';
  if (typeof input.source !== 'string' || !input.source.trim() || input.source.length > 240) return 'Source required';
  if (typeof input.confidence !== 'number' || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) return 'Confidence must be 0–1';
  return null;
}

export function remember(db, input) {
  const issue = validateMemory(input);
  if (issue) throw new TypeError(issue);
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const previous = db.prepare('SELECT * FROM memories WHERE key = ?').get(input.key);
    const id = previous?.id || randomUUID();
    db.prepare(`INSERT INTO memories (id,key,value,source,confidence,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET
      value=excluded.value,source=excluded.source,confidence=excluded.confidence,updated_at=excluded.updated_at`)
      .run(id, input.key, input.value, input.source, input.confidence, previous?.created_at || now, now);
    db.prepare('INSERT INTO memory_revisions (memory_id,prior_value,next_value,changed_at) VALUES (?,?,?,?)')
      .run(id, previous?.value || null, input.value, now);
    db.exec('COMMIT');
    return db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function recall(db, query = '', limit = 25) {
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  return db.prepare(`SELECT * FROM memories WHERE key LIKE ? ESCAPE '\\' OR value LIKE ? ESCAPE '\\'
    ORDER BY confidence DESC, updated_at DESC LIMIT ?`).all(pattern, pattern, Math.max(1, Math.min(limit, 100)));
}

export function forget(db, id) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    db.prepare('DELETE FROM memory_revisions WHERE memory_id = ?').run(id);
    db.exec('COMMIT');
    return result.changes === 1;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
