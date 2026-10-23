# Open Jules

Full-stack asynchronous coding agent frontend for Google Labs Jules, with gateway, memory, and agent stack hooks from the [Open Source AI Full Stack](https://github.com/CodesbyFebin/Open-Source-Ai-Full-Stack) catalog.

Built against the official Jules REST API (`https://jules.googleapis.com/v1alpha`).

## Features

- Create coding sessions (with or without plan approval)
- List connected GitHub sources
- Poll session activities (plans, progress, diffs, messages)
- Approve plans
- Send follow-up messages to active sessions
- Kimi Work–style sidebar + dashboard
- AGENTS.md awareness guidance
- **Gateway** stub (`/api/gateway/chat`) — wire to LiteLLM, Bifrost, Portkey, FreeLLMAPI
- **Memory** stub (`/api/memory`) — wire to Mem0, OpenMemory, Graphiti
- Ready for Vercel / any Node host

## Setup

1. Get a Jules API key from [jules.google.com/settings](https://jules.google.com/settings)
2. Copy `.env.example` to `.env.local`
3. Set `JULES_API_KEY=your_key_here`
4. (Optional) Set `GATEWAY_BASE_URL` and `GATEWAY_API_KEY` for the router
5. Connect your GitHub repos to Jules via the official web app first (required for sources)
6. Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment

```
JULES_API_KEY=...
GATEWAY_BASE_URL=http://localhost:4000/v1   # optional LiteLLM/Bifrost
GATEWAY_API_KEY=sk-local
```

## Architecture notes

- Frontend never sees the API key — all calls go through Next.js API routes.
- Sessions follow the official states: QUEUED → PLANNING → AWAITING_PLAN_APPROVAL → IN_PROGRESS → COMPLETED / FAILED.
- Supports `requirePlanApproval: true` and `automationMode: AUTO_CREATE_PR`.
- Repoless sessions are supported (omit sourceContext).
- Gateway and memory are drop-in compatible with projects listed in the Open Source AI Full Stack catalog (gateways-routing and memory categories).

## Official docs used

- https://jules.google/docs/
- https://jules.google/docs/api/reference/
- Sessions, Activities, Sources, Authentication, Environment, AGENTS.md
- Open-Source-Ai-Full-Stack catalog (gateways, memory, coding-agents)
