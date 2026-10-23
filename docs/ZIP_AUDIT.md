# ZIP compatibility audit — 2026-10-23

Source: user-supplied `yhvpd1kJHxT2FZMK-grok-workspace.zip`, inspected without executing the archive.

## Architecture
- TanStack Start / Vite / React 19 frontend; Next.js 14 / React 18 in this repository.
- Large Grok-specific scaffolding, UI utilities, preview build outputs, generated assets, and auth components.
- PostgreSQL-compatible `desk_runs` concept; isolated by user ID in its TanStack server function.
- Client-side Zustand persistent store for task state, schedules, codebase files and memories.

## Veracity findings
- `src/lib/jules/store.ts` uses `window.setTimeout` to advance agent plans and produces result labels from `runLabels`.
- `src/lib/jules/core.ts` hardcodes providers, model latency estimates, example codebase files and generated code.
- `src/lib/jules/bench.ts` runs a local deterministic toy harness, not external coding agents or live task suites.
- Repository listings in `github.ts` are hardcoded; the loaded file contents are a snapshot, not fetched from GitHub.
- Client-local schedules do not represent durable server-side scheduling.
- No evidence in the imported code of real shell execution, sandbox isolation, PR creation or end-to-end provider benchmarking.

## Security / portability
- Do not copy Grok platform auth assumptions, generated Vercel bundles, prewired environment files, or local-storage session state into production.
- Do not copy `CODEBASE` fake project files, fabricated model metrics, “checks passed” labels, or simulated tool traces.
- Preserve no upstream Grok branding or build output.
- Transfer UI concepts and the desk journal idea only, implemented natively within the existing Next.js server-side boundaries.

## Integration made
- Violet dark theme carried into current page.
- Real Google Jules API session and source flows retained.
- Added server-backed PostgreSQL desk journal with honest statuses (`note`, `blocked`, `review`) instead of user-defined `ok` or synthetic verification badges.
- Placeholder integrations explicitly called out as unavailable.

## Remaining
- Multi-user RBAC, durable job orchestration, scoped provider credentials, isolated execution workers and real benchmark adapters need separate implementation.
- Live coding-provider and PostgreSQL deployments remain unverified without configured credentials.
