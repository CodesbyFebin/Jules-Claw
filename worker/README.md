# Open Jules isolated verifier

This worker must run separately from Next.js on a trusted Docker host. It is **not** launched by the web request handler. Docker access is root-equivalent and must be limited to trusted operators.

## Build and run

```bash
docker build -t open-jules-verifier:local ./worker
DATABASE_URL=postgresql://... npm run worker:verify
```

Apply SQL migrations first. The worker polls PostgreSQL and claims jobs via `FOR UPDATE SKIP LOCKED`.

Profiles:
- `syntax`: parse JS/CJS/MJS using `node --check`, no source execution.
- `node-tests`: execute detected `*.test.js|mjs|cjs` and `*.spec.js|mjs|cjs` with Node's built-in runner. This executes untrusted test code inside Docker; dependencies are not installed.

Containment: fixed command profiles, Docker `--network none`, read-only filesystem and bind mount, non-root user, no-new-privileges, default seccomp, cap-drop all, pids/memory/cpu limits, tmpfs /tmp, 150 second outer timeout. No Docker socket is mounted into the container.

Public GitHub repository fetch only. Failures and unavailable dependencies are not hidden. The worker records exit codes and truncated stdout/stderr. Private repository checkout is not supported. Do not treat a syntax profile as proof of program correctness.

There is no cloud-hosted worker configured by this repository. Provide your own trusted host, PostgreSQL, and Docker.

## v0.6 — Crash recovery and ownership fencing

Apply `migrations/0003_worker_leases.sql` **with all older verifier workers stopped**, then deploy the updated worker. Every claimed job has an owner UUID, attempt count, and five-second heartbeat. A worker detects jobs whose heartbeat is older than five minutes, marks them `infra_failure` with an explicit uncertainty message, and attempts to remove the orphan Docker container. Recovery never converts an abandoned job to a pass or automatically retries untrusted code. Final results are accepted only from the owning worker while the job is still running.

The 5-minute threshold is conservative for transient database stalls. Worker heartbeat failures and Docker cleanup errors appear in worker stderr logs; deploy host monitoring for them. Existing jobs left `running` by earlier worker versions are treated as abandoned on first v0.6 recovery. This is an operational fail-safe, **not** a production load-testing attestation.

The attached alternate Omega shell offers UI and harness taxonomy ideas, but its hard-coded latency/model attributes and agent labels are not evidence of real execution and are not imported into the backend.
