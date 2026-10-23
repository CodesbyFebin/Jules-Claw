# Open Web LLM — Tenant Isolation Release Gate

**Status: staging only. Do not enable public multi-user hosting.**

## Pain points addressed

1. A verified session without tenant ownership must not read or mutate another tenant's data.
2. A user-supplied tenant ID must never override server-verified membership.
3. One tenant's memory must not enter another tenant's recall, deletion or revision history.
4. A shared worker queue must not expose job output or cancellation across tenants.

## Implementation

- Session identity is checked using the self-hosted authentication service and an active PostgreSQL membership. Ambiguous memberships deny access.
- Desk and verification API queries use transaction-scoped tenant context and explicit tenant predicates.
- Memory uses independently persisted SQLite WAL databases per verified tenant, under the configured local memory directory.
- Queue records gain a non-null tenant UUID and PostgreSQL RLS through `0007_tenant_verification.sql`.
- Enqueue quotas are tenant-specific and atomically accounted in PostgreSQL.
- Unqualified external-provider APIs are disabled when session identity staging is enabled; they are **not** counted as multi-tenant capable.

## Required coordinated rollout

1. Back up PostgreSQL, stop previous verifier workers, deploy updated APIs, then apply migrations `0005`, `0006`, `0007` in order. Verify actual schema and `FORCE ROW LEVEL SECURITY` settings.
2. Use separate database principals: unprivileged HTTP role subject to RLS and a dedicated least-privilege worker role. The worker requires `WORKER_DATABASE_URL` in session-auth mode and refuses the web database URL. Assign any RLS bypass only to the isolated worker principal if genuinely necessary; prohibit direct database access from users.
3. Run real Better Auth migrations; provision a tenant and explicit active membership for the operator. Do not auto-promote every registered account to an owner.
4. Run simultaneous two-user, two-tenant HTTP and database tests, including session expiry, forged ID headers, tenant changes, memory key collisions, job cancellation and worker crash recovery.
5. Exercise PostgreSQL backup/restore, worker lease fencing, concurrent quota updates and retention erasure on actual services.
6. Confirm OpenShell, Docker, model outage fallback and coding-provider API behavior separately with bounded runtime evidence.

## Unverified

- Actual PostgreSQL RLS and worker service-role qualification; the migration has not been applied to a deployed database here.
- OpenShell execution and hostile isolation tests; executable unavailable here.
- Live model/provider calls, external availability recovery, and long-running container workers.
- Complete feature-wide tenant authority: previously shared integrations stay blocked in session identity mode.

Passing unit tests or Next.js compilation alone is not evidence of an operational multi-tenant deployment.
