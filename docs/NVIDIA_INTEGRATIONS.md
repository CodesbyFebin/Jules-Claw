# NVIDIA integrations for Jules Claw

This is an **opt-in integration foundation**, not a bundled NVIDIA runtime. Jules Claw is independent of NVIDIA and Google. No upstream repository code is vendored into this project.

## Implemented

- `GET /api/integrations/nvidia`: factual configuration state; `configured_not_verified` is never presented as ready.
- `POST /api/integrations/nvidia`: static-only SkillSpector scan of an existing, explicitly allowlisted local skill directory. Body: `{"skill":"directory-name"}`.
- No arbitrary CLI arguments, shell, remote URLs, or repository execution accepted.
- Path traversal and symlink-escape protection; subprocess timeout/output caps; fail-closed parsing.
- A scanner verdict never automatically installs or runs a skill.

This endpoint inherits Jules Claw's single-operator Basic authentication and same-origin mutation check. Do not expose it publicly without stronger identity, job queues, rate limits and tenant isolation.

## Operator setup

1. Review and pin a trusted SkillSpector release from https://github.com/NVIDIA/SkillSpector . Read its license and dependencies.
2. Install it separately on the backend host. Run `skillspector scan --help` and check compatibility before enabling.
3. Create a directory controlled by the operator, containing only candidate skill subdirectories. Never point it at your home directory or the workspace root.
4. Configure `NVIDIA_SKILL_ROOT=/absolute/path/to/approved-candidate-skills` and `NVIDIA_SKILL_SCAN_ENABLED=true`. Optionally set `SKILLSPECTOR_BINARY` to an absolute binary path.
5. POST a specific directory name. The tool is called with `--no-llm --format json`. Some static analysis may send package coordinates to OSV.dev; see upstream documentation.
6. Review the raw findings before taking any installation action. This version deliberately returns `safeToInstall: false` until independent approval is recorded elsewhere.

## Planned, not integrated

| Upstream | Why | Current status |
| --- | --- | --- |
| [NVIDIA/OpenShell](https://github.com/NVIDIA/OpenShell) | Isolated agent runtime/policies | Environment feature flag only, no execution adapter |
| [NVIDIA/NemoClaw](https://github.com/NVIDIA/NemoClaw) | Reference blueprint for OpenShell-managed agents | Not integrated |
| [NVIDIA/NeMo-Agent-Toolkit](https://github.com/NVIDIA/NeMo-Agent-Toolkit) | Agent evaluation/tracing | Not integrated |
| [NVIDIA/SkillEvaluator](https://github.com/NVIDIA/SkillEvaluator) | Agent skill scoring | Not integrated |
| [NVIDIA/NeMo-Retriever](https://github.com/NVIDIA/NeMo-Retriever) | Optional document ingestion | Not integrated |
| [NVIDIA/TensorRT-LLM](https://github.com/NVIDIA/TensorRT-LLM) | Optional GPU inference | Not integrated |

OpenShell documented host support must be checked separately. In particular, do not mark Intel macOS as verified merely because the integration is configured.

## Verification

Run `npm test`, `npm run check:worker`, and `npm run build`. CI is the source of truth for PR status. A live end-to-end SkillSpector scan requires an operator-installed binary and is not exercised in CI.

## Provenance

All links point to their upstream owners. Follow each license and security guidance; this change does not redistribute their code or imply endorsement.
