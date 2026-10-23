# Jules Claw
<img width="2172" height="724" alt="Jules Claw_ Cybernetic Coding Control Plane" src="https://github.com/user-attachments/assets/02ed6231-0f45-4308-b521-9ea8a9b4e70c" />

**Jules Claw — Autonomous Coding Control Plane**  
*Plan. Code. Verify. Ship.*

Jules Claw by **CodesbyFebin** is a single-operator workspace for orchestrating **real Google Jules** coding sessions, reviewing plans and changes, observing pull requests, and recording verification evidence. The brand refers to this independent integration product; it is **not** a claim to be Google's official Jules service.

> **Product identity:** Jules Claw  
> **Repository (unchanged for link compatibility):** `CodesbyFebin/Open-Jules`  
> **Existing API/environment namespaces:** unchanged to avoid breaking deployments.

## v0.2 preview

- Create and monitor real Jules sessions; approve plans and send feedback
- Connected sources, paginated sessions and activity history
- Display Jules-generated patch artifacts and pull-request output links
- **Fail-closed HTTP Basic authentication** across UI and API
- Same-origin guard for browser-originated mutations
- Validated inputs, normalized session resource names, timeouts and upstream errors
- Explicitly unavailable memory until durable storage exists
- Optional authenticated OpenAI-compatible gateway proxy

## Run locally

Set the following in `.env.local`:

```env
JULES_API_KEY=your_jules_api_key_here
OPEN_JULES_USERNAME=admin
OPEN_JULES_PASSWORD=replace_with_a_random_secret_16_chars_min
# Optional:
# GATEWAY_BASE_URL=https://your-gateway.example/v1
# GATEWAY_API_KEY=your_gateway_api_key
```

Run `npm install && npm run dev`; open http://localhost:3000 and log in using HTTP Basic authentication. Do not deploy without HTTPS. Authentication is **single-operator only**; this is not yet suitable for multiple users or shared workspaces.

Jules sources must first be connected through the official Jules web app. `JULES_API_KEY` must never be exposed to the browser.

## Honest capability boundaries

The project currently delegates coding execution to Google's Jules API. No local agent swarm, benchmark runner, sandbox execution, durable jobs, or memory service is present. The optional gateway is a separate chat-completions proxy; it does not change Jules's internal model routing. An HTML concept mockup may be used as design reference only, not as evidence of live agents or measured benchmarks.

Production multi-user deployment requires account-backed authentication, repository authorization, durable state, security tests, audit logs, and operational rate limits.

Official Jules reference: https://jules.google/docs/api/reference/

## v0.3 Desk backend

Optional PostgreSQL-backed evidence journal inspired by the uploaded workspace. Configure `DATABASE_URL` to a PostgreSQL database, then apply [`migrations/0001_desk.sql`](migrations/0001_desk.sql) using your database migration process before opening **Desk / Evidence**.

Journal entries are user-authored records and are never labeled as automatically verified test results. No database configured → the endpoint returns 503, rather than claiming to persist data.

`OPEN_JULES_PASSWORD` still protects all API routes. HTTP Basic is intended for one operator behind HTTPS, not public multi-tenancy.

Read [the ZIP audit](docs/ZIP_AUDIT.md) before importing additional pieces. The supplied TanStack app is not directly source-compatible with Next.js and its timed agent and benchmark routines are simulations.

## GitHub CI evidence

When Jules outputs a GitHub pull request URL, click **Fetch live GitHub CI evidence** in its session detail. The server fetches the PR head and check-run data directly from the GitHub REST API, preserving links and recorded statuses. For private repositories configure a server-only `GITHUB_TOKEN` with read access to PRs and checks. Without a token, public GitHub API rate limits apply.

The app does not infer success from an absent check run or an LLM message.

## Jules Ω source audit

The additional Omega archive includes visual layout concepts but not independently verified agent execution. Its fixed model metrics, timed benchmark results, fake test-success strings and prefilled swarm state were excluded. See [`docs/OMEGA_AUDIT.md`](docs/OMEGA_AUDIT.md).

The interface is responsive on mobile browsers. Native Android, macOS, and Linux clients are not included.

## v0.4 — Durable isolated verification

The verifier accepts only two fixed profiles: `syntax` (checks JavaScript syntax, does not execute code) and `node-tests` (executes discovered JS test files). Jobs are queued in PostgreSQL using immutable GitHub PR head SHAs, processed by a separate trusted worker, and displayed with actual stdout/stderr, exit code and status. No job is marked passed without a successful worker execution.

1. Apply `migrations/0001_desk.sql` and `migrations/0002_verification_jobs.sql`.
2. Build a sandbox image: `docker build -t open-jules-verifier:local ./worker`.
3. On a **trusted host with Docker**, configure `DATABASE_URL` and run `npm run worker:verify`.
4. Open a Jules session with a GitHub PR output, choose a verification profile, and click **Queue isolated check**.

The worker retrieves **public GitHub repositories only**, runs source code inside a Docker container with network disabled, read-only source mount, dropped capabilities, no-new-privileges, PID/CPU/memory/time limits, and nonroot UID. It never accepts arbitrary shell commands from the browser. Node tests requiring uninstalled dependencies may fail; this is reported as a failure rather than a pass. Do not give untrusted users Docker daemon access or deploy this worker on a shared host without additional isolation. The Docker daemon itself remains highly privileged.

The web app does not execute repository code. Stop/cleanup requests are handled by the worker while it is online. If Docker or network access is unavailable, the job reports an infrastructure failure. Full live worker execution still requires a configured Docker host and database.

## v0.5 — Six-role advisory gateway

The **Advisory Swarm** view performs six actual server-side OpenAI-compatible gateway calls only when `SWARM_ENABLED=true`, `GATEWAY_BASE_URL`, `GATEWAY_API_KEY`, and all six `SWARM_MODEL_*` values are configured. One request first gets an architect plan, then a coder proposal, three parallel reviewer assessments (debugger, security, verifier), and a final manager synthesis. It displays real response text, gateway-reported token usage when available, and measured call latency. The button explicitly authorizes gateway usage and possible charges.

These are **advisory model roles**, not six autonomous tool-executing processes; no files are written, no tests are run, and no changes are deployed. Verification evidence must come from the separate isolated worker and GitHub CI. Rate limits and provider usage caps still apply; unlimited tokens are not supported.

CI also builds the Docker verifier image and executes syntax/test smoke fixtures under the restricted container profile. Live long-running worker and configured gateway providers require separate operational credentials and infrastructure.

## v0.6 — Crash recovery and ownership fencing

Apply `migrations/0003_worker_leases.sql` **with all older verifier workers stopped**, then deploy the updated worker. Every claimed job has an owner UUID, attempt count, and five-second heartbeat. A worker detects jobs whose heartbeat is older than five minutes, marks them `infra_failure` with an explicit uncertainty message, and attempts to remove the orphan Docker container. Recovery never converts an abandoned job to a pass or automatically retries untrusted code. Final results are accepted only from the owning worker while the job is still running.

The 5-minute threshold is conservative for transient database stalls. Worker heartbeat failures and Docker cleanup errors appear in worker stderr logs; deploy host monitoring for them. Existing jobs left `running` by earlier worker versions are treated as abandoned on first v0.6 recovery. This is an operational fail-safe, **not** a production load-testing attestation.

The attached alternate Omega shell offers UI and harness taxonomy ideas, but its hard-coded latency/model attributes and agent labels are not evidence of real execution and are not imported into the backend.
