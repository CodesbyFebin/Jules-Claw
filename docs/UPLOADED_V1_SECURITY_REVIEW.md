# Uploaded Jules Claw v1.0 archive: integration security review

Date: 2026-10-23. Source: user-provided `jules_claw_fullstack.zip` and HTML control plane. **Status: NOT APPROVED FOR MERGE OR PUBLIC HOSTING.**

This is a static inspection of the supplied source and archive, not a runtime attestation. Keep `feat/release-hardening-foundation` as the authoritative security baseline.

| Priority | Evidence | Risk | Required correction |
| --- | --- | --- | --- |
| Critical | `server.mjs` routes requests without invoking `middleware.js:checkBasicAuth`; `middleware.js` exports a helper rather than a Next.js 16 `proxy`. | Unauthenticated local API mutations on the standalone server; replacing existing proxy would remove its protection. | Shared session authentication and authorization across all servers/routes; reject requests before body parsing. |
| Critical | `lib/security-kernel.mjs:clearContaminationOutOfBand` accepts arbitrary caller-provided `attestationSignature` and clears taint. A test sends `fido2_biometric_ok` as plain JSON. | An attacker can self-attest and reset the security gate. | Bind a verified human approval to identity, challenge, expiry, action digest and one-time consumption; never accept an attestation string as proof. |
| Critical | `lib/db.mjs:createInitialSeed` creates fabricated passed verification jobs, TPM/mTLS attestations, activity evidence, costs and security events. | Synthetic history masquerades as live audit evidence. | Remove seeds from real state; use separately labeled optional demo fixtures. Derive status only from observed runtime evidence. |
| High | `lib/db.mjs:LocalDurablePool` dispatches on SQL regular expressions, uses shared mutable JSON state, and silently ignores write failures. | No reliable SQL semantics, transactions, tenant enforcement or durable concurrent writes; corruption can reset state to seed. | Reuse SQLite local memory or a real PostgreSQL driver with migrations, transactions and fail-closed errors. |
| High | `server.mjs` uses an unbounded `for await (const chunk of req)` request body accumulation. | Memory exhaustion. | Enforce a small, route-specific body limit and abort oversized requests. |
| High | HTML dashboard API representations and jobs are mutated in browser `localStorage`; no application `fetch()` call appears in the control plane. | UI operations are simulated locally and not backend-evidenced. | Connect UI through authenticated API calls and honest pending/error states. |
| High | Archive `package.json` downgrades Next.js to `^14.2.5` and React to `^18.3.1`, and has no committed lockfile. | Reproducibility and security regression from the hardened Next.js 16 / React 19 branch. | Preserve existing locked dependency versions; scan and review any proposed changes. |
| High | `lib/security-kernel.mjs` claims SHA3-256 Merkle audit, but `lib/db.mjs:sha256` computes SHA-256 and the log is a mutable local JSON array. | Misleading tamper resistance and algorithm labeling. | Canonical hash format, append-only storage, independent checkpointing and verifier; document algorithm accurately. |
| High | `lib/cortical-memory.mjs` uses fixed token arithmetic and `simulatePoisonDrift` sets a constant 0.78 drift. | No actual tokenizer-backed budget or measured embeddings/drift. | Attach real tokenizer, embeddings, provenance and adversarial retrieval tests; label simulations. |
| High | Test 5 enqueues a PR and expects an immediate `passed` job without real PR checks or isolated worker evidence. | False qualification of execution and isolation. | Bind immutable commit, real queue lease, sandbox attestations and recorded stdout/stderr. |
| High | No validated identity provider, tenant membership, database RLS coverage or worker tenant propagation in the archive. | Cross-user access if published. | Implement supported self-hosted auth, verified sessions and tenant-scoped access in all routes, workers and data stores. |

## Merge policy

1. Do **not** replace the existing `proxy.js`, authentication checks, quota gates, migration history or lockfile with the archive.
2. Do **not** import `.data/jules_claw_db.json` as operational evidence.
3. Reuse only audited pure algorithms/UI elements on separate, testable commits with no permission escalation.
4. Keep public hosting and auto-execution disabled until identity, isolation, data durability, sandbox and adversarial gates pass.
5. The archive's six `node:test` integration cases are not proof of TPM, mTLS, OpenShell, cloud providers, durable WAL or real agent performance.

Pain points addressed by this review: supply-chain regression; misleading security posture; unverified self-approval; fake audit history; accidental exposure of unprotected APIs.
