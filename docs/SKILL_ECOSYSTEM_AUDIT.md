# Open Web LLM skill ecosystem audit — October 2026

This is a **source-selection and safety integration**, not a mass clone or deployment of third-party software. Metadata was checked against the GitHub repository APIs on 2026-10-23. The catalog is in `data/skill-sources.json`. A license identifier returned by GitHub is *not* a substitute for reviewing the license and every dependency.

## Integrated in this PR

- A read-only research catalog exposed at authenticated `GET /api/integrations/skills`.
- An **opt-in** `POST /api/integrations/skills` that accepts explicitly provided UTF-8 Markdown text with a full 40-character commit pin and conservative license allowlist. Enable with `JULES_SKILL_PREFLIGHT_ENABLED=true`.
- Deterministic SHA-256 evidence and advisory indicators for secret access, prompt override, remote download-and-execute, privileged commands and destructive patterns. Tests prove rejection of traversal paths, floating revisions, and oversized files.
- **No** skill fetch, install, dynamic import, shell invocation, MCP activation, agent delegation, credential access, or automatic approval.

## Priorities

| Upstream | Decision | Why |
| --- | --- | --- |
| [openclaw/clawhub](https://github.com/openclaw/clawhub) | Registry design reference | Mature discovery/search concepts, but marketplace entries are untrusted |
| [openclaw/clawscan](https://github.com/openclaw/clawscan) | Adapter candidate | Scan composition is useful; needs CLI schema and sandbox test |
| [openclaw/agent-skills](https://github.com/openclaw/agent-skills) | Individual skill candidate | Review each file and pin exact commit; no bulk installation |
| [AMAP-ML/SkillClaw](https://github.com/AMAP-ML/SkillClaw) | Evaluation reference | Evolution only after replayable verification gates |
| [thClaws/thClaws](https://github.com/thClaws/thClaws) | Architecture reference | Native Rust runtime is not source-compatible with Next.js |
| [flipped-aurora/gin-vue-admin](https://github.com/flipped-aurora/gin-vue-admin) | RBAC design reference | A wholesale Gin/Vue admin merge would duplicate the app and auth |
| [prompt-security/clawsec](https://github.com/prompt-security/clawsec) | License review | AGPL-3.0 demands review of distribution implications |
| [limecloud/lime](https://github.com/limecloud/lime) | Hold | No recognized license in GitHub metadata |
| [Gk0Wk/ClawGuard](https://github.com/Gk0Wk/ClawGuard) | Hold | License not established; conceptually useful approval gates |
| [ShamyaHaria/clawvault](https://github.com/ShamyaHaria/clawvault) | Hold | License not established |
| [omnimind-ai/OmniBot](https://github.com/omnimind-ai/OmniBot) | Hold | Native Android automation introduces sensitive device permissions |
| [ClawBio/ClawBio](https://github.com/ClawBio/ClawBio) | Hold | License/domain review required |

The wider user-provided list includes medical, security, trading, network, device-control and research skills. None is automatically eligible because a repository is public or popular. The source catalog is deliberately narrow.

## Safe promotion flow

1. Record upstream owner/name, exact commit SHA, path and license; manually verify that the supplied content matches upstream.
2. Scan static content, dependencies, transitive scripts, permission requests and prompt-injection attempts with multiple independent analyzers.
3. Run any proposed tool or skill only in an ephemeral, network-restricted container under a least-privilege capability policy. Never execute skill instructions merely because the scan returned no findings.
4. Review a diff and request an exact-action human approval. Use allowlisted MCP tools and scoped credentials. No autonomous deployment of unfamiliar skills.
5. Benchmark on deterministic tasks; record actual command, environment, exit code, stdout/stderr, source commit and evidence digest. Fail closed on missing evidence.
6. Track updates separately and re-scan when a pinned revision changes.

Current implementation covers only the **metadata and heuristic preflight** portion. These scans can have false positives and false negatives. An external sandbox, scanner attestation, install flow, permission system and benchmark are **not implemented** here.

## API

`GET /api/integrations/skills` returns curated provenance and decision fields. HTTP Basic authentication and same-origin mutation checks come from the app's existing middleware.

`POST /api/integrations/skills` takes:
```json
{"repository":"openclaw/agent-skills","commit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","path":"skills/review/SKILL.md","license":"MIT","content":"# Review\nInspect code."}
```

A response with `decision: requires_human_review` is never an approval or installation confirmation. The SHA-256 digest hashes the caller-supplied text; Open Web LLM does **not** independently fetch or attest the upstream GitHub blob.
