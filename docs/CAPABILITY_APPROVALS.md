# Capability approval boundary (incremental)

**Pain point:** autonomous tools may execute more power than the user knowingly granted. A normal user should not have to understand shell flags to approve a task.

The initial approval store is SQLite, local and durable. Agents can request only two fixed verification capabilities, tied to an exact task ID and a pinned SHA-256 input digest. Unknown fields, paths, arbitrary shell commands, and elevated capabilities are rejected deterministically.

1. An authenticated client submits a bounded action to `POST /api/capabilities`.
2. The response returns an opaque request UUID. `GET /api/capabilities?id=...` reports its status.
3. The human opens **a local interactive terminal** on the same host and runs `npm run approval -- <request-uuid>`.
4. The terminal displays the exact requested action and SHA-256 digest. The human types `APPROVE` to grant once; any other input rejects.
5. With `JULES_APPROVED_EXECUTION_ENABLED=true`, an operator starts `npm run execute:approved -- <request-uuid>`. For `verify.syntax` only, the local executor consumes the one-shot approval, then runs a **single fixed sandbox process** that reads the target once and checks both the SHA-256 digest and syntax of those same bytes; it records hash-linked audit events. Other capabilities remain non-executable.

**Current limitation:** The adapter is wired and mock-tested, but a real OpenShell installation and sandbox were **not** available for verification. The single-process read avoids a file-swap between digest check and syntax parsing, but the executor still cannot attest sandbox policy or prevent a compromised sandbox runtime from forging output. The terminal is an operator convenience rather than cryptographic proof of human presence. HTTP Basic remains single-operator; public multi-user hosting is not supported. Leave execution disabled in production until isolation is verified.

Threats tested: replay, action mutation, unauthorized capability, extra command fields, expiration, hash mismatch, failed sandbox command, audit-record tampering and denial. Audit events are locally hash-linked, **not** immutable against a host administrator who can rewrite both rows and hashes. Still required: actual sandbox policy enforcement, external audit anchoring, permission presentation UX, peer identity, signed intent, and adversarial E2E tests.
