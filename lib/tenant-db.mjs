// Tenancy must be derived from verified server identity, never request input.
// Each query runs in its own transaction so pooled connections cannot leak
// a previous caller's tenant setting to another request.
export const LOCAL_TENANT = '00000000-0000-4000-8000-000000000001';

export function validateTenantId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    throw new TypeError('Verified tenant UUID required');
  }
  return id;
}

export async function withTenantTransaction(pool, verifiedTenantId, operation) {
  validateTenantId(verifiedTenantId);
  if (typeof operation !== 'function') throw new TypeError('Transaction operation required');
  const client = await pool.connect();
  let begun = false;
  try {
    await client.query('BEGIN');
    begun = true;
    await client.query("SELECT set_config('jules.tenant_id',$1,true)", [verifiedTenantId]);
    const result = await operation(client);
    await client.query('COMMIT');
    begun = false;
    return result;
  } catch (error) {
    if (begun) {
      try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
    }
    throw error;
  } finally {
    client.release();
  }
}
