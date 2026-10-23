# Open Web LLM — Live Qualification Runbook

This document records **what is run**, **what is not run**, and **which resources are still needed**. Passing a CI job is not permission to enable public multi-user hosting.

## No-charge boundary

The repository is currently public. The automated PostgreSQL qualification runs only on the **standard** GitHub-hosted `ubuntu-latest` runner, which GitHub documents as free for public repositories. If the repository becomes private, stop using this workflow until usage and billing are reviewed. Do not change to large or premium runners. Do not start chargeable provider calls or hosted databases from CI.

The workflow has a 12-minute timeout, read-only GitHub permissions, PRs must originate from the same repository, no production secrets, no provider API requests, and no exposure of database ports outside loopback. Its PostgreSQL database and backup disappear with the ephemeral VM.

## Implemented automated database gate

File: `.github/workflows/qualification-postgres.yml`

1. Start a disposable PostgreSQL 16 service database named `open_web_llm_qualification`.
2. Execute existing real lease/heartbeat/fencing tests on the temporary database.
3. Apply migration files `0001`–`0007` sequentially.
4. Create **two independently credentialed**, non-superuser, non-BYPASSRLS roles for app and worker checks.
5. Exercise FORCE RLS, two-tenant inserts, cross-tenant reads/deletes/writes, cross-tenant job access, missing-tenant-context denial, and concurrent isolation.
6. Dump using `pg_dump` to a local custom archive, restore into a separate disposable database using `pg_restore`, verify retained records and FORCE RLS.
7. Publish only a factual GitHub Actions step summary; failure stops promotion.

**Scope limitation:** The CI worker role is deliberately *not* granted BYPASSRLS. The production worker, if it requires cross-tenant queue polling, still needs a separately reviewed privilege model and explicit independent authorization tests. The CI tests database boundaries but not complete browser login/session expiration, production retention, backup schedules, or multi-hour workloads.

## Independently gated prerequisites

| Gate | Required secure input/environment | Boundaries and exit evidence |
| --- | --- | --- |
| Session lifecycle | Disposable Better Auth test identities, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, disposable PostgreSQL backing store, isolated application host | Real cookies, CSRF, revocation, session expiry, replay and two-tenant HTTP negative tests; never expose test accounts publicly |
| Worker crash recovery | Docker-enabled Linux runner already available for syntax checks; separately configured `WORKER_DATABASE_URL` and scoped job fixtures | Kill worker during a leased job, restart it, require fenced/unknown status without duplicate side effects; observe actual container IDs and DB rows |
| OpenShell hostile execution | **Separately approved, isolated Linux VM or dedicated host with OpenShell CLI** and no production credentials | Explicit sandbox ID, deny network/filesystem escape, cgroups/capabilities verification, hostile fixtures with captured exit codes; **do not run hostile payloads on GitHub shared runner** |
| Local model fallback | Reachable sandboxed `JULES_LOCAL_LLM_URL` or equivalent loopback model endpoint | Actual token generation and outage/recovery traces; isolated CI hosted VM cannot reach an arbitrary developer's localhost |
| Remote inference | Approved remote gateway endpoint and `GATEWAY_API_KEY`; strictly capped free quota | Bounded single-prompt live output, 429 and provider outage fallback, measured latency, token cost from provider usage; pause before any charge |
| Coding provider | `JULES_API_KEY` or a supported provider credential from GitHub Actions **secrets**, never source, logs or issue text | Single read-only/non-mutating bounded API request, explicit provider-confirmed free quota and rate limits; no PR creation or external writes by default |

All provider credentials belong in an isolated secret manager or GitHub Actions secrets restricted to a manually reviewed environment. Never paste secret values in chat. Do not run provider calls merely because secrets exist: confirm provider's no-charge usage allocation at execution time and enforce local request/time/token caps.

## Promotion criteria

Record each gate as PASS, FAIL, or BLOCKED_NOT_EXECUTED, with immutable run link, commit SHA, service versions, duration and redacted logs. A database PASS does not automatically promote Docker, OpenShell, authentication, LLM, coding quality or production readiness. Public hosting stays disabled until every applicable security gate and an independent assessment pass.
