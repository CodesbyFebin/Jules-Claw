import { getPool, validateDesk } from '../../../lib/desk';
import { LOCAL_TENANT, withTenantTransaction } from '../../../lib/tenant-db.mjs';
import { requestIdentity, assertPermission } from '../../../lib/request-identity.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const identity = assertPermission(await requestIdentity(request), 'read');
    const result = await withTenantTransaction(getPool(), identity.tenantId, client => client.query('SELECT id, title, detail, status, created_at FROM desk_entries WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50', [identity.tenantId]));
    return Response.json({ items: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return Response.json({ error: e.status === 503 ? e.message : 'Desk storage unavailable' }, { status: e.status || 503 }); }
}

export async function POST(request) {
  try {
    const identity = assertPermission(await requestIdentity(request), 'write');
    const body = await request.json();
    const problem = validateDesk(body);
    if (problem) return Response.json({ error: problem }, { status: 400 });
    const result = await withTenantTransaction(getPool(), identity.tenantId, client => client.query(
      'INSERT INTO desk_entries (title, detail, status, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id, title, detail, status, created_at',
      [body.title.trim(), body.detail.trim(), body.status, identity.tenantId],
    ));
    return Response.json({ item: result.rows[0] }, { status: 201 });
  } catch (e) { return Response.json({ error: e.status === 503 ? e.message : 'Unable to save desk entry' }, { status: e.status || 503 }); }
}
