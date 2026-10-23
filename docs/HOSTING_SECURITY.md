# Hosting security: local single-operator only

**Pain point:** single shared HTTP Basic credentials cannot enforce tenant identity, per-user policy, or revoke individual sessions.

The app now launches development and production servers bound to `127.0.0.1`, defaults to `local-single-operator` mode, and rejects hosted requests in its Next.js proxy. `VERCEL=1` is explicitly rejected. This is **defense in depth**; forwarded/Host headers are attacker-controlled, and the proxy alone is not a security boundary.

Do not use `next start -H 0.0.0.0`, a public reverse proxy, tunneling, or cloud deployment while using HTTP Basic. Deployment on a public host requires a real identity provider, session verification in route handlers, CSRF protection, per-user RBAC and resource isolation. No environment flag enables public hosting as a shortcut.

For legitimate remote access during development, use an authenticated private tunnel with additional access controls, and still treat public hosting as unsupported.

Existing external deployments will intentionally return HTTP 503 until they are migrated to a separately verified multi-user authentication implementation.
