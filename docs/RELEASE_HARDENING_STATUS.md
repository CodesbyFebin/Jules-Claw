# Release hardening evidence (2026-10-23)

This report distinguishes checked functionality from integration plans. **Do not deploy this application as a multi-user service.**

## Implemented and locally checked

| Area | Evidence | Limit |
| --- | --- | --- |
| Reproducible npm dependency graph | `package-lock.json`, `npm ci` in CI | This locks packages, not operating systems or container base images |
| Next.js/React upgrade | Next.js 16.4.3 + React 19.3.1; `npm test` 30/30 and `npm run build` pass | UI/browser regression testing not completed |
| Dependency audit | `npm audit --omit=dev --audit-level=low`: 0 findings locally on 2026-10-23 | Future advisories can change the result |
| Verification events | PostgreSQL trigger in `migrations/0004_audit_quotas.sql` | Must apply migration on deployed database; audit records are not tamper-evident |
| Distributed quota | Atomic `INSERT ... ON CONFLICT ... UPDATE` rate bucket; 30 verification enqueues per hour | Global single-operator quota, not per-user; requires PostgreSQL |
| OpenShell fixed-profile adapter | Mock-spawn tests cover CLI argv, disabled state, bad sandbox names, failed exit | No live CLI/gateway available; not called by existing worker or UI |
| Reproducible trusted benchmark | `npm run benchmark` runs local tests in subprocesses with measured elapsed time/exit codes and lockfile hash | No LLM generation, coding-agent ranking, or third-party execution |
| Pinned skill retrieval | Opt-in, read-only source fetch from the fixed GitHub raw host with explicit full commit pin, allowlisted catalog candidate, response-size and timeout controls | No installation, upstream signature attestation or independent malware scanner |

## Still blocking public multi-user launch

1. Replace HTTP Basic with an identity provider, verified sessions, CSRF protections, repository-bound authorization and per-user quotas. The present service **remains single-operator only**.
2. Run real Jules and gateway calls with provider credentials against production-like accounts; capture redacted evidence.
3. Run SkillSpector and OpenShell with installed binaries on policy-controlled hosts, and validate signed execution receipts. No scanner claims a skill is safe.
4. Complete end-to-end PostgreSQL and multi-hour Docker worker tests, restart/failover recovery, metrics, alerting and cancellation races.
5. Connect the OpenShell adapter to the existing queued verifier only after isolated storage, policy attestation and cleanup semantics are reviewed.
6. Build a true coding-agent benchmark with blinded task sets, immutable repos, patch submission, isolated hidden tests, repeat runs, correctness, latency, token and cost reporting.
7. No desktop/mobile wrappers are shipped in this repository; actual macOS, Windows, Linux, Android and iOS validation remains **NOT_RUN**.
8. Skill install approvals, remote source attestation, malware scanners, sandbox execution and evidence-gated auto-selection remain separate unimplemented workflows. The new pinned fetch route only returns a heuristic review report.

## Operating notes

- Apply migrations in order through `0004_audit_quotas.sql` before exposing verification enqueue. Missing quota storage returns an error rather than permitting unbounded jobs.
- OpenShell requires an existing sandbox and explicit `OPENSHELL_EXEC_ENABLED=true`. The adapter has only two allowed commands: a Node syntax check and Node tests. It does not create sandboxes, upload code, pass secrets, or grant arbitrary shell access.
- Only use `npm ci` from the checked-in lockfile in automated environments.
- Benchmark command timings are local measurements of trusted repository test executions. Do not compare them to external model claims.
