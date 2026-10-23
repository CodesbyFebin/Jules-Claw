# Jules Claw — Operations Console

The attached standalone HTML prototype displayed fictitious shell execution and arbitrary resource metrics. The integrated `/claw` page instead reads the real existing `/api/verification` queue and per-job records.

## Supported exact commands

- `help`, `status`, `jobs`
- `job <uuid>` to inspect saved stdout/stderr, exit code and timestamps
- `verify syntax <https://github.com/owner/repo/pull/n>`
- `verify tests <https://github.com/owner/repo/pull/n>`
- `cancel <uuid>` (requests cooperative cancellation)
- `clear`

Input is parsed into enumerated API operations. **No shell interpreter, arbitrary filesystem, MCP, npm, git or SSH access is granted.** The client sends profile and PR URL to the existing queue API; only the trusted worker executes restricted profiles in Docker. Real test status is sourced from PostgreSQL and remains unavailable if DATABASE_URL or migrations are missing.

The console intentionally does not show fictitious CPU, memory, uptime, container IDs, MCP connectivity, test pass rates, security block counts or a claim of an installed OpenClaw runtime. Job history is not a full security audit trail. A future OpenClaw executor requires separate integration, exact capability grants and independent sandbox validation.

No new environmental privileges are required. Existing single-operator HTTP Basic middleware protects the console and APIs.
