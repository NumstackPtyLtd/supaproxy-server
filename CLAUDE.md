# SupaProxy

AI operations platform. Open source engine + SDK.

## Architecture

```
Backend (Hono, port 3001)
├── config.ts (requireEnv, no fallbacks)
├── middleware/auth.ts (requireAuth)
├── routes/ (modular routers)
│   ├── auth.ts, org.ts, queues.ts
│   ├── workspaces.ts, conversations.ts
│   ├── connectors.ts, query.ts
├── Redis (BullMQ queues, port 6380)
└── MySQL (Docker, port 3308)

Packages
├── @supaproxy/shared (types, entities, API contracts)
└── @supaproxy/sdk (TypeScript API client)
```

## Start Dev

```bash
docker compose up -d
./apps/server/node_modules/.bin/tsx apps/server/src/index.ts
```

## Stack

| Layer | Tech |
|---|---|
| Monorepo | Turborepo + pnpm |
| Backend | Hono + TypeScript |
| Auth | JWT cookies via Hono |
| DB | MySQL 8 (Docker, port 3308) |
| Queue | Redis 7 + BullMQ (Docker, port 6380) |

## Code Rules

### Architecture
- **Use `requireAuth` middleware** for protected routes. Never manually parse JWT cookies in route handlers.
- **Routes in `apps/server/src/routes/`**, not in index.ts. Each file exports a Hono sub-app.
- **Config in `apps/server/src/config.ts`** via `requireEnv()`. All env vars throw if missing.
- **Business logic in services, not route handlers.** Route handlers validate input, call services, return responses.

### No Hardcoded Values
- **No env var fallbacks.** Never `|| 'http://localhost'` or `?? 'default'`. Use `requireEnv()` which throws if missing.
- **No hardcoded API URLs.** Use environment config.
- **No hardcoded model IDs in code.** Model options come from the API or config.
- **No hardcoded secrets or fallbacks.** JWT secret, DB password, API keys must be required env vars with no default.
- **No magic numbers.** Timeouts, limits, and thresholds must be named constants or config values.

### Provider Agnosticism
- **No AI provider names in user-facing output.** Say "AI provider", "language model", or "model tier".
- **No provider-specific token formats as placeholders.** No `sk-ant-`, `xoxb-`, `xapp-`.

### Type Safety
- **No `any` types.** Create interfaces for all DB results, API responses, and function parameters.
- **No `as any` casts.** If TypeScript cannot infer the type, define an interface.

### Error Handling
- **No empty catch blocks.** Every `.catch()` must log the actual error object.
- **Check `res.ok` before parsing.** Every `fetch().then(r => r.json())` must check the response status first.
- **Validate JSON before using.** Wrap `JSON.parse()` in try/catch with fallback.

### Security
- **Never commit `.env` files.** Only `.env.example` with placeholders.
- **Use bcrypt for password hashing.** SHA256 is not acceptable.
- **JWT secret must be required.** No fallback values.
- **Cookie `secure: true` in production.** Use `IS_PRODUCTION` from config.

### Testing
- **New features need tests.** At minimum: unit tests for services, integration tests for API endpoints.
- **Run `/audit-code` before PRs.** Full codebase scan including security, types, dead code.

## Skills

| Skill | Purpose |
|---|---|
| `/audit-code` | Full codebase scan: security, types, dead code, duplicates, architecture |
| `/simplify` | Post-code review: magic numbers, error handling, duplicates |
| `/prod-ready` | Pre-deploy: error handling, cookies, res.ok checks |
| `/no-defaults` | Env var enforcement: no `\|\| 'fallback'` patterns |
| `/add-api-route` | Scaffold a new route with auth middleware |
| `/debug-mcp` | Diagnose MCP connection failures: ports, headers, tools, agent runtime |
| `/debug-clients` | Diagnose consumer issues: token checks, bindings, lifecycle |
| `/agnosticism` | Enforce provider/client agnosticism |

## Hooks

- **Pre-commit**: blocks commits with hardcoded URLs, provider leaks, or committed secrets. Warns on `any` types and empty catch blocks.
