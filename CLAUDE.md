# SupaProxy

Open-source AI operations engine. Hono API server.

## Architecture

```
src/
├── config.ts          requireEnv(), no fallbacks
├── index.ts           Hono app, health check, route mounts
├── shared/            Types, entities, API contracts
├── middleware/
│   ├── auth.ts        requireAuth (JWT cookie verification)
│   └── validate.ts    parseBody (Zod schema validation)
├── routes/            Modular Hono routers
│   ├── auth.ts        Login, logout, session, signup
│   ├── org.ts         Org CRUD, settings, users
│   ├── queues.ts      BullMQ queue management
│   ├── workspaces.ts  Workspace CRUD, dashboard, activity
│   ├── conversations.ts Conversation list, detail, close
│   ├── connectors.ts  MCP + Slack connectors
│   └── query.ts       Agent loop entry point
├── core/              Business logic
│   ├── agent.ts       AI + MCP tool orchestration
│   ├── lifecycle.ts   Conversation lifecycle loop
│   ├── workspace.ts   Workspace operations
│   └── conversation.ts Conversation operations
├── consumers/         External message consumers
│   └── slack.ts       Slack Socket Mode consumer
├── auth/              Auth services
│   ├── db.ts          User queries
│   └── manager.ts     Auth business logic
├── db/                Database layer
│   ├── pool.ts        MySQL connection pool
│   ├── migrations.ts  Schema migrations
│   ├── types.ts       Row type definitions
│   └── seed.ts        Seed data
└── observability/
    └── audit.ts       Audit logging
```

## Related Repos

| Repo | Visibility | Purpose |
|---|---|---|
| supaproxy-server (this) | Public (MIT) | Engine: API server |
| supaproxy-sdk | Public (MIT) | TypeScript SDK (`@supaproxy/sdk` on npm) |
| supaproxy-dashboard | Private | Astro + React frontend |

## Start Dev

```bash
pnpm install                       # Dependencies
cp .env.example .env               # Configure env vars
# Edit .env: set JWT_SECRET and DB_PASSWORD (see .env.example for details)
docker compose up -d mysql redis   # MySQL + Redis (reads DB_PASSWORD from .env)
pnpm dev                           # API on :3001
```

## Stack

| Layer | Tech |
|---|---|
| Backend | Hono + TypeScript |
| Auth | JWT cookies (httpOnly, secure in prod) |
| Validation | Zod schemas via `parseBody()` |
| DB | MySQL 8 (Docker, port 3308) |
| Queue | Redis 7 + BullMQ (Docker, port 6380) |
| Consumers | Slack (Socket Mode via @slack/bolt) |

## Code Rules

### Architecture
- **Use `requireAuth` middleware** for protected routes. Never manually parse JWT cookies in route handlers.
- **Routes in `src/routes/`**, not in index.ts. Each file exports a Hono sub-app.
- **Config in `src/config.ts`** via `requireEnv()`. All env vars throw if missing.
- **Business logic in `core/` services, not route handlers.** Route handlers validate input, call services, return responses.
- **Validation via `parseBody(c, schema)`** from `middleware/validate.ts`. Use Zod schemas.
- **Consumers in `consumers/`**. Each consumer handles one external message source and calls into `core/agent.ts`.

### No Hardcoded Values
- **No env var fallbacks.** Never `|| 'http://localhost'` or `?? 'default'`. Use `requireEnv()` which throws if missing.
- **No hardcoded API URLs.** Use environment config.
- **No hardcoded model IDs in code.** Model options come from the DB or config.
- **No hardcoded secrets or fallbacks.** JWT secret, DB password, API keys must be required env vars with no default.
- **No magic numbers.** Timeouts, limits, and thresholds must be named constants or config values.

### Provider Agnosticism
- **No AI provider names in user-facing output.** Say "AI provider", "language model", or "model tier".
- **No provider-specific token formats as placeholders.** No `sk-ant-`, `xoxb-`, `xapp-`.

### Type Safety
- **No `any` types.** Create interfaces for all DB results, API responses, and function parameters.
- **No `as any` casts.** If TypeScript cannot infer the type, define an interface.
- **DB row types in `db/types.ts`.** Every `pool.execute<T>()` call uses a typed row interface extending `RowDataPacket`.

### Error Handling
- **No empty catch blocks.** Every `.catch()` must log the actual error object.
- **Check `res.ok` before parsing.** Every `fetch().then(r => r.json())` must check the response status first.
- **Validate JSON before using.** Wrap `JSON.parse()` in try/catch with fallback.
- **Log errors with pino.** Use structured logging: `log.error({ error: err.message }, 'Context')`.

### Security
- **Never commit `.env` files.** Only `.env.example` with placeholders.
- **Use bcrypt for password hashing.** SHA256 is not acceptable.
- **JWT secret must be required.** No fallback values. Minimum 32 characters enforced in config.ts.
- **Cookie `secure: true` in production.** Use `IS_PRODUCTION` from config.
- **Error responses must not leak internals.** No stack traces, file paths, or SQL in client responses. Log full details server-side.

### Testing
- **New features need tests.** At minimum: unit tests for services, integration tests for API endpoints.
- **Run `/audit-code` before PRs.** Full codebase scan including security, types, dead code.
- **Vitest** for all tests. Config at `vitest.config.ts`.

## Skills

| Skill | Purpose |
|---|---|
| `/add-api-route` | Scaffold a new Hono route with auth, validation, DB queries |
| `/add-consumer` | Add a new consumer type (like Slack) with agent loop integration |
| `/audit-code` | Full server codebase scan: types, errors, architecture, dead code |
| `/prod-ready` | Pre-deploy: cookies, error leaks, missing auth, res.ok checks |
| `/no-defaults` | Env var enforcement: no `\|\| 'fallback'` patterns |
| `/debug-mcp` | Diagnose MCP connection failures: ports, headers, tools |
| `/debug-clients` | Diagnose consumer connectivity: tokens, bindings, lifecycle |
| `/restart-servers` | Restart Hono dev server and verify health |

## Hooks

- **Pre-commit**: blocks commits with hardcoded localhost URLs, provider-specific token formats (`sk-ant-`, `xoxb-`, `xapp-`), or committed secrets. Warns on `any` types and empty catch blocks. Only checks `.ts` files.

## Contributing

### PR Workflow
1. Branch from `main` with a descriptive name (`feat/`, `fix/`, `refactor/`)
2. Make changes following the code rules above
3. Run `/audit-code` to catch violations
4. Run tests: `pnpm test`
5. Open PR against `main`

### Adding a New Route
Run `/add-api-route` or follow the pattern in `src/routes/`. Every route file:
1. Exports a `Hono<AuthEnv>` sub-app
2. Uses `requireAuth` middleware on protected paths
3. Validates input with `parseBody(c, zodSchema)`
4. Delegates to `core/` services for business logic
5. Gets mounted in `index.ts` via `app.route('/', router)`

### Adding a New Service
1. Create the file in `src/core/`
2. Accept typed parameters, return typed results
3. Use `getPool()` for DB access, pino for logging
4. Keep route handlers thin -- they call your service and return JSON

### Adding a New Consumer
Run `/add-consumer` or follow the pattern in `src/consumers/slack.ts`. A consumer:
1. Connects to an external message source (Slack, webhook, etc.)
2. Maps incoming channels/endpoints to workspaces via DB lookup
3. Calls `runAgent()` from `core/agent.ts` with the query
4. Posts the response back through the external service
5. Starts at server boot from `index.ts`
