# Jules Claw local-first foundation — evidence and limits

This is an incremental implementation, **not** the full 2030 specification or a benchmark victory over other agents.

| Feature | Pain point addressed | Implemented evidence | Limits |
| --- | --- | --- | --- |
| Local SQLite memory | Context is not durable memory | `lib/local-memory.mjs`, revision and erasure tests | Not yet semantic/episodic graph memory; local disk needs host backup and volume encryption |
| Provenance/confidence | Memory poisoning through unsupported claims | Source and confidence are required on every write | Caller-supplied values are not independently authenticated; untrusted writes must be blocked at UI/policy boundary |
| Graceful inference fallback | Remote provider outages create total loss of capability | Loopback-only local model URL and fallback route | Depends on a separately installed and running OpenAI-compatible local model; no automatic model installation |
| Host resource safety | Agents exhaust shared host resources | Deterministic memory/disk/load checks; read-only/halt states | Checks are admission control, not kernel quotas or OOM guarantees; enforce process cgroups/container limits before untrusted work |

## Security decisions

- The current HTTP Basic authentication is **single-operator only**. Do not expose for multi-user hosting. Replace with OIDC, durable user sessions, CSRF defenses and per-user authorization before that.
- The local model endpoint must use loopback HTTP; public `LOCAL_LLM_URL`s and embedded credentials are rejected. Avoid proxying it through public network interfaces.
- Resource telemetry failure halts model execution; no LLM prompt can increase the computed capability level.
- Every memory write requires a source but this is metadata, not a trusted provenance signature. Treat retrieved memories as untrusted context, not instructions. Do not route memory content to tools without approval.
- SQLite persists on the server host, **not the browser device**. A serverless or remotely deployed instance is not genuinely local-first; run the Next.js Node server on the user's machine with a persistent volume.

## Verify

`npm ci && npm test && npm run build`

Configure `JULES_LOCAL_LLM_URL` and `JULES_LOCAL_LLM_MODEL` to test a running local inference backend. Provider, desktop/mobile device, Docker and threat-simulation validation remain unverified here.
