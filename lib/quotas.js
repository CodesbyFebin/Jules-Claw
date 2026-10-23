// Atomic, shared PostgreSQL budget. Fails closed when storage is unavailable.
export async function consumeQuota(pool, operation, limit, windowSeconds = 3600, now = new Date()) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(operation)) throw new Error('Invalid quota operation');
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('Invalid quota limit');
  if (!Number.isInteger(windowSeconds) || windowSeconds < 60 || windowSeconds > 86400) throw new Error('Invalid quota window');
  const bucket = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const result = await pool.query(
    `INSERT INTO request_quotas(operation,window_start,used) VALUES($1,$2,1)
     ON CONFLICT(operation,window_start) DO UPDATE
     SET used=request_quotas.used+1 WHERE request_quotas.used < $3
     RETURNING used`,
    [operation, bucket, limit]
  );
  // pg exposes rowCount; PGlite's PostgreSQL-compatible driver exposes
  // affectedRows instead. RETURNING rows are authoritative for both.
  return { allowed: result.rows.length === 1, windowStart: bucket.toISOString(), limit, used: result.rows[0]?.used ?? limit };
}
