# Better Auth identity staging: local-only

**Pain point:** a shared HTTP Basic password cannot represent independently revocable users or tenant memberships.

Jules Claw now pins Better Auth as a self-hosted identity dependency and exposes its Next.js route **behind the existing local Basic-auth proxy**, not instead of it. This is an isolated staging foundation; it does **not** enable public hosting, RBAC, or tenant access to existing APIs.

## Required setup

1. Keep the server bound to `127.0.0.1`, set `OPEN_JULES_PASSWORD` to a strong operator secret, and set `JULES_DEPLOYMENT_MODE=local-single-operator`.
2. Provision local PostgreSQL and run the supported Better Auth migration tool for the exact installed version before enabling login. Back up existing state first.
3. Set `BETTER_AUTH_SECRET` to a fresh secret of at least 32 random characters, `DATABASE_URL` to the local database, `BETTER_AUTH_URL=http://127.0.0.1:3000`, and `JULES_AUTH_ENABLED=true`.
4. Verify authenticated sign-up/sign-in/session revocation with the service actually running. Rotate bootstrap credentials and restrict account registration before onboarding real users.

The auth routes intentionally inherit Basic authentication and same-origin mutation checks. Cookies alone do not authorize access to existing data routes. There is no untrusted `X-Tenant-ID` or equivalent request-header shortcut.

## Release gates still open

- Verify signed sessions server-side at each API and background entry point.
- Store memberships and role grants in the transactional database, with least-privilege checks and forced tenant RLS on **all** tables.
- Make memory, sessions, jobs, receipts, skills, approvals and audit tenant-bound; test cross-tenant replay, forged headers, stale membership and concurrent revocation.
- Validate real PostgreSQL migration and restore, multi-process workers, Jules credentials, sandbox policy and LLM fallback.
- Connect the uploaded HTML views to authorized APIs. Do not expose its localStorage demo records as real evidence.

Do not enable public or multi-user hosting until these gates pass.
