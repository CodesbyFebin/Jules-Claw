import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ALLOWED = new Set(['verify.syntax', 'verify.node-tests']);
export function canonicalAction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid action');
  if (!ALLOWED.has(value.capability)) throw Error('Capability is not allowlisted');
  if (typeof value.taskId !== 'string' || !/^[A-Za-z0-9_-]{8,96}$/.test(value.taskId)) throw Error('Invalid task ID');
  if (typeof value.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceSha256)) throw Error('Pinned source digest required');
  // Fixed schema prevents an agent from smuggling paths, commands or privileges.
  if (Object.keys(value).sort().join(',') !== 'capability,sourceSha256,taskId') throw Error('Unexpected action fields');
  return JSON.stringify({ capability: value.capability, taskId: value.taskId, sourceSha256: value.sourceSha256 });
}

export function actionDigest(action) { return createHash('sha256').update(canonicalAction(action)).digest('hex'); }

export function openApprovalDb(file = process.env.JULES_APPROVAL_DB_PATH || '.jules-state/approvals.sqlite') {
  if (file !== ':memory:') mkdirSync(dirname(resolve(/* turbopackIgnore: true */ file)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file === ':memory:' ? file : resolve(/* turbopackIgnore: true */ file));
  if (file !== ':memory:' && process.platform !== 'win32') chmodSync(resolve(/* turbopackIgnore: true */ file), 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY, action_digest TEXT NOT NULL, action_json TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('pending','approved','consumed','rejected')),
      requested_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, decided_at INTEGER,
      consumed_at INTEGER
    );`);
  return db;
}

export function requestApproval(db, action, now = Date.now()) {
  const json = canonicalAction(action);
  const id = randomUUID();
  const expires = now + 10 * 60_000;
  db.prepare('INSERT INTO approvals (id,action_digest,action_json,state,requested_at,expires_at) VALUES (?,?,?,?,?,?)')
    .run(id, createHash('sha256').update(json).digest('hex'), json, 'pending', now, expires);
  return { id, action, state: 'pending', expiresAt: new Date(expires).toISOString() };
}

export function decideApproval(db, id, decision, now = Date.now()) {
  if (!['approved', 'rejected'].includes(decision)) throw Error('Invalid decision');
  const result = db.prepare('UPDATE approvals SET state=?,decided_at=? WHERE id=? AND state=? AND expires_at>?')
    .run(decision, now, id, 'pending', now);
  return result.changes === 1;
}

/** Atomic one-shot authorization for a *specific* digest. No execution occurs here. */
export function consumeApproval(db, id, action, now = Date.now()) {
  const digest = actionDigest(action);
  const result = db.prepare(`UPDATE approvals SET state='consumed',consumed_at=?
    WHERE id=? AND state='approved' AND action_digest=? AND expires_at>?`)
    .run(now, id, digest, now);
  return result.changes === 1;
}

export function approvalStatus(db, id) {
  return db.prepare('SELECT id,action_digest,state,requested_at,expires_at,decided_at,consumed_at FROM approvals WHERE id=?').get(id) || null;
}
