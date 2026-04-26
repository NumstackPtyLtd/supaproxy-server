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

See the [supaproxy repo](https://github.com/NumstackPtyLtd/supaproxy) for the full project overview, cross-repo workflow, and shared code principles.

## Start Dev

```bash
pnpm install                       # Dependencies
cp .env.example .env               # Configure env vars
# Edit .env: set JWT_SECRET and DB_PASSWORD (see .env.example for details)
docker compose up -d mysql redis   # MySQL + Redis (reads DB_PASSWORD from .env)
pnpm dev                           # API on :3001
```

## Session workflow

### At the start of every session
1. Run `git fetch --all` and check recent changes: `git log --all --oneline --since="3 days ago" --no-merges`.
2. Check if this CLAUDE.md is still accurate (architecture, skills, conventions). Update immediately if outdated.

### Before creating a PR (MANDATORY)
1. Run quality checks: `pnpm build && pnpm test`.
2. Self-review the diff against the code rules. Check for: any types, empty catches, hardcoded values, provider names, missing auth.
3. Check cross-repo impact:
   - If routes changed: SDK needs a new or updated method. Note this in the PR description.
   - If `src/shared/` types changed: SDK re-exports may need updating.
   - If the API contract changed (new/removed/renamed endpoints): this is a breaking change. Note semver impact.
4. PR description must include a "Cross-repo impact" section listing affected repos and required follow-up.

### After a PR merges to main
1. If routes or shared types changed: open a follow-up issue or PR in supaproxy-sdk.
2. If this is a significant release: create a git tag (`git tag vX.Y.Z`).
3. Notify the team to run `/sync-knowledge` from the docs repo.

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
- All env vars use `requireEnv()` from `src/config.ts` which throws if missing.

For shared code principles (provider agnosticism, type safety, error handling, security, writing standards), see the [supaproxy CLAUDE.md](https://github.com/NumstackPtyLtd/supaproxy/blob/main/CLAUDE.md#code-principles-apply-everywhere).

### Type Safety
- DB row types in `db/types.ts`. Every `pool.execute<T>()` call uses a typed row interface extending `RowDataPacket`.

### Error Handling
- Log errors with pino. Use structured logging: `log.error({ error: err.message }, 'Context')`.
- Error responses must not leak internals. No stack traces, file paths, or SQL in client responses.

### Security
- Error responses must not leak internals. No stack traces, file paths, or SQL in client responses. Log full details server-side.

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
