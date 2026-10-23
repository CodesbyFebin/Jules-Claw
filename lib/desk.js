import pg from 'pg';

let pool;
export function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw Object.assign(new Error('DATABASE_URL is not configured'), { status: 503 });
  if (!pool) {
    const parsed = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw Object.assign(new Error('Invalid DATABASE_URL'), { status: 503 });
    pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
  }
  return pool;
}

export function validateDesk(body) {
  if (!body || typeof body !== 'object') return 'Invalid request body';
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160) return 'Title must be 1–160 characters';
  if (typeof body.detail !== 'string' || !body.detail.trim() || body.detail.length > 4000) return 'Detail must be 1–4000 characters';
  if (!['note', 'blocked', 'review'].includes(body.status)) return 'Invalid status';
  return null;
}
