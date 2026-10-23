import { getPool } from '../../../../lib/desk';
import { validateJobId } from '../../../../lib/verification';
import { requestIdentity, assertPermission } from '../../../../lib/request-identity.mjs';
import { withTenantTransaction } from '../../../../lib/tenant-db.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  if (!validateJobId(id)) return Response.json({ error: 'Invalid job id' }, { status: 400 });
  try {
    const identity = assertPermission(await requestIdentity(request), 'read');
    const r = await withTenantTransaction(getPool(), identity.tenantId, client => client.query('SELECT * FROM verification_jobs WHERE id = $1 AND tenant_id=$2', [id, identity.tenantId]));
    if (!r.rowCount) return Response.json({ error: 'Job not found' }, { status: 404 });
    return Response.json({ job: r.rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return Response.json({ error: e.status === 401 ? 'Unauthenticated' : e.status === 403 ? 'Forbidden' : 'Verification storage unavailable' }, { status: e.status || 503 }); }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!validateJobId(id)) return Response.json({ error: 'Invalid job id' }, { status: 400 });
  try {
    const identity = assertPermission(await requestIdentity(request), 'execute');
    const r = await withTenantTransaction(getPool(), identity.tenantId, client => client.query(
      `UPDATE verification_jobs SET
         cancel_requested = true,
         status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
         finished_at = CASE WHEN status = 'queued' THEN now() ELSE finished_at END
       WHERE id = $1 AND tenant_id = $2 AND status IN ('queued','running')
       RETURNING id, status, cancel_requested`,
      [id, identity.tenantId]
    ));
    if (!r.rowCount) return Response.json({ error: 'Job is not cancellable' }, { status: 409 });
    return Response.json({ job: r.rows[0] });
  } catch (e) { return Response.json({ error: e.status === 401 ? 'Unauthenticated' : e.status === 403 ? 'Forbidden' : 'Verification storage unavailable' }, { status: e.status || 503 }); }
}
