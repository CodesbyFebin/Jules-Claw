# Open Web LLM qualification gates

Security > memory > autonomy > cost > usability. A green unit test is not equivalent to production qualification.

| Gate | Pain point | Current evidence | Release blocker |
| --- | --- | --- | --- |
| OpenShell execution | Host escape or malicious skill execution | Fixed argv, digest binding, single-read syntax validation, mock tests | OpenShell binary and hardened sandbox policy are unavailable here; validate read-only mounts, no secrets, network deny, CPU/RAM/PID limits and attack fixtures on a real runner. |
| Multi-user identity/RBAC | One compromised account accesses everyone's data | Hosted access currently fails closed; single-operator loopback Basic only | Implement actual session identity, server-verified roles and tenant-scoped queries across **every** API, job and memory path. Do not enable hosted mode beforehand. |
| Tenant journal foundation | Journal entries could leak across tenants | `0005_tenant_desk.sql` enables forced RLS and the desk API sets tenant context transaction-locally | Only the single-operator desk path is converted; verified multi-user identities and remaining tables/routes are not integrated. |
| Concurrent quotas | Burst traffic bypasses per-process counters | 64 concurrent requests through PGlite, 7 admitted/57 rejected with persisted `used=7`; failure rejects | Repeat against external PostgreSQL from separate processes and hosts, including crashes and retries. |
| Audit durability | Operators cannot reconstruct harmful actions | Local hash-linked execution events and DB audit trigger migration | Apply migration on durable external Postgres; verify backups, retention, tenant attribution and tamper-alerting. |
| Coding provider, LLM and workers | Demo mocks conceal provider failures | Unit tests and deterministic subprocess benchmarks | Run live authenticated provider sessions, outage/recovery local fallback, long-running Docker worker and restart/lease tests. Credentials/services are not present in this runner. |
| Reproducible benchmarks | Unmeasured speed/security claims | `npm run benchmark` records task manifest/lockfile SHA-256, command, duration, exit status and output | Add full agent tasks with known expected patches, prompts, measured quality/cost, adversarial skill samples and repeated runs across actual platforms. |

## Reproduce available measurements

Run `npm ci`, `npm test`, `npm run benchmark` from a pinned Git commit, and preserve stdout, commit SHA, hardware specifications, operating system, and report JSON. Do not compare numbers obtained on unequal hardware as if they were product scores. `npm run benchmark` exercises trusted tests and does not execute arbitrary generated code.

## Required live execution checklist

1. Provision a disposable hardened OpenShell sandbox with verified mount, network and resource policies; keep `JULES_APPROVED_EXECUTION_ENABLED` off until independent attestation.
2. Test hostile syntax inputs, symlink swaps, file changes after approval, process timeout, oversized output and forbidden file/network access; capture machine-readable logs.
3. Configure a staging identity service and durable Postgres. Prove user A cannot read, modify, approve, or query user B's sessions, memory, skills, jobs, audits or quotas, even when forging tenant headers.
4. Test at least two concurrent app replicas against the same PostgreSQL and verify audit completeness plus exact quota ceilings across restarts.
5. Qualify provider HTTP error/timeout/cancellation behavior with real configured coding providers and local/remote LLMs; power-cycle long-running Docker workers and verify restart reconciliation.

None of these live gates are marked passed by the local PGlite tests.

## Tenant migration ordering

Deploy tenant-aware desk API and apply `0005_tenant_desk.sql` together during maintenance before allowing journal writes. Existing journal rows migrate to the fixed local operator tenant. Forced RLS requires transaction-local `jules.tenant_id`; connections must never inherit tenant identity from HTTP headers. Remaining data domains require their own migration and cross-tenant adversarial tests before hosted mode can be considered.
