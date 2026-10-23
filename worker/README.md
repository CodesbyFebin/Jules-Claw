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
