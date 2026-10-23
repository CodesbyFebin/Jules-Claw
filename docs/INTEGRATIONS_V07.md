# Open Jules v0.7 integration slice

## Implemented

- `GET /api/github/tree?repo=CodesbyFebin/Jules-Claw&ref=main`: server-side GitHub API access; optional `GITHUB_TOKEN`; allowlisted repositories with `GITHUB_ALLOWED_REPOS`; 20 calls per minute **per app instance** (not distributed), one thousand-file response cap. GitHub API limits still apply. The response is live GitHub evidence, not an indexed clone or workspace state.
- `POST /api/gateway/chat`: OpenAI-compatible gateway configured by `GATEWAY_BASE_URL`, `GATEWAY_API_KEY`, `GATEWAY_MODELS`. Exactly 1–40 string messages; primary model from allowlist; at most three configured attempts. Failover only on 408/429/5xx or transport timeout; 4xx auth/validation errors are final. Successful response carries `_openJules.modelUsed` and per-attempt measured latency/status. No invented tokens or costs; model usage is provider-reported.
- `/lab`: browser WebWorker execution of single-file trusted JS or TS snippets. Uses TypeScript transpilation (not static typechecking) and a 2.5-second main-thread termination timer. **Not a secure sandbox**: network access is not blocked, malicious code can send requests. Do not paste secrets or execute untrusted code. Use separate Docker verification jobs for PR code.
- `/sql`: actual PGlite in-memory SQL. Supports native Postgres-compatible joins, filters, INSERT and EXPLAIN ANALYZE; the two tables are **explicitly seeded demo fixtures**. The SQL lab is not connected to production DB or Jules sessions. It loses state on reload.

## Configuration

```env
GATEWAY_BASE_URL=https://your-openai-compatible-gateway/v1
GATEWAY_API_KEY=server-only-token
GATEWAY_MODELS=preferred-model,fallback-model,final-model
GITHUB_TOKEN=server-only-fine-grained-read-token
GITHUB_ALLOWED_REPOS=CodesbyFebin/Jules-Claw
```

## Out-of-scope / next milestones

- Distributed global rate limiting (e.g. Redis) and per-user usage budgets; HTTP Basic is single-operator.
- Durable 10-agent execution and context compression with raw-memory recall. Summaries cannot provide unlimited model tokens.
- Z3/CVC5 proof jobs and OpenClaw integration: require a separate allowlisted, constrained executor and proof artifact verification.
- Tauri 2, Electron and Capacitor packages: need native toolchains, code signing, deep links, secure IPC and platform validation. No generated wrapper is called shipping-ready.
- Fair benchmark harness: must run held-out tasks with fixed inputs, ground-truth checks and recorded model responses. The supplied Omega mock's `98.4%` and `99.1%` are unverified and excluded.

## API shape

`POST /api/gateway/chat`:

```json
{ "model": "preferred-model", "messages": [{ "role": "user", "content": "Review this function" }] }
```

`model` may be omitted to select the first configured model. A successful response preserves provider `choices` and `usage` fields and adds `_openJules`. Misconfigured gateway returns HTTP 503; exhausted routes return 502 with measured attempts. Failed upstream bodies are not returned to avoid leaking provider internals.
