# Capability approval boundary (incremental)

**Pain point:** autonomous tools may execute more power than the user knowingly granted. A normal user should not have to understand shell flags to approve a task.

The initial approval store is SQLite, local and durable. Agents can request only two fixed verification capabilities, tied to an exact task ID and a pinned SHA-256 input digest. Unknown fields, paths, arbitrary shell commands, and elevated capabilities are rejected deterministically.

1. An authenticated client submits a bounded action to `POST /api/capabilities`.
2. The response returns an opaque request UUID. `GET /api/capabilities?id=...` reports its status.
3. The human opens **a local interactive terminal** on the same host and runs `npm run approval -- <request-uuid>`.
4. The terminal displays the exact requested action and SHA-256 digest. The human types `APPROVE` to grant once; any other input rejects.
5. A trusted sandbox executor **must** call `consumeApproval` with the identical action atomically before execution. Once used, rejected or expired, that approval cannot be reused.

**Current limitation:** Step 5 is implemented and unit-tested as a library function, but no live executor is wired to it. Thus approvals grant **no live tool execution** in this release. The terminal is an operator convenience rather than a cryptographic proof of human presence. HTTP Basic remains single-operator; public multi-user hosting is not supported.

Threats tested: replay, action mutation, unauthorized capability, extra command fields, expiration and denial. Still required: actual sandbox policy enforcement, audit chaining, permission presentation UX, peer identity, signed intent, and adversarial E2E tests.
