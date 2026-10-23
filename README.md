# Open Jules

Authenticated single-operator dashboard for real Google Jules coding sessions.

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
