import { authConfiguration, selfHostedAuth } from './self-hosted-auth.mjs';
import { LOCAL_TENANT, validateTenantId } from './tenant-db.mjs';
import { getPool } from './desk.js';

// A browser-controlled tenant header is never an authority. When identity
// mode is active, only a database-backed session and membership may grant it.
export async function requestIdentity(request, { getAuth = selfHostedAuth, membershipLookup } = {}) {
  if (!authConfiguration().enabled) {
    return { mode: 'local-single-operator', userId: null, tenantId: LOCAL_TENANT, role: 'owner' };
  }
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) throw Object.assign(new Error('Verified session required'), { status: 401 });
  const lookup = membershipLookup || lookupMembership;
  const membership = await lookup(session.user.id);
  if (!membership) throw Object.assign(new Error('No active tenant membership'), { status: 403 });
  validateTenantId(membership.tenantId);
  if (!['owner', 'admin', 'operator', 'viewer'].includes(membership.role)) throw Object.assign(new Error('Invalid tenant role'), { status: 403 });
  return { mode: 'verified-session', userId: session.user.id, tenantId: membership.tenantId, role: membership.role };
}

export async function lookupMembership(userId) {
  const result = await getPool().query(
    `SELECT tenant_id AS "tenantId", role FROM jules_tenant_memberships
     WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at ASC LIMIT 2`,
    [userId],
  );
  // Never silently select one of multiple organizations.
  if (result.rowCount !== 1) return null;
  return result.rows[0];
}

export function assertPermission(identity, action) {
  const roles = {
    read: ['owner', 'admin', 'operator', 'viewer'],
    write: ['owner', 'admin', 'operator'],
    execute: ['owner', 'admin', 'operator'],
    administer: ['owner', 'admin'],
  };
  if (!roles[action]?.includes(identity?.role)) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return identity;
}
