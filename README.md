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
