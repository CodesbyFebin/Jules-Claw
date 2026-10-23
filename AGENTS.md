# Open Jules Agent Guide

This repository is a full-stack interface for the Jules asynchronous coding agent.

## Conventions

- All Jules API calls must go through server-side routes under `/app/api`.
- Never expose `JULES_API_KEY` to the client.
- Prefer `requirePlanApproval: true` for interactive sessions.
- Respect session states from the official API.
- When generating plans or code, reference AGENTS.md if present in the target repo.
- Setup scripts should be discrete install/test commands only (no long-running processes).

## Environment

Jules VMs are Ubuntu with Node, Python, Go, Java, Rust, Bun, and common tools preinstalled. Use the environment setup docs for complex projects.
