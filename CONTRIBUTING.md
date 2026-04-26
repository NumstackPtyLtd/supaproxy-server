# Contributing to SupaProxy

Thanks for your interest in contributing! This guide will help you get started.

## Development setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for MySQL and Redis)

### Getting started

```bash
git clone https://github.com/NumstackPtyLtd/supaproxy-server.git
cd supaproxy-server
pnpm install

# Start MySQL + Redis
docker compose up -d mysql redis

# Configure environment
cp .env.example .env
# Edit .env:
#   JWT_SECRET — generate with: openssl rand -hex 32
#   DB_PASSWORD — must match what MySQL started with. Check with:
#     docker inspect supaproxy-mysql --format '{{range .Config.Env}}{{println .}}{{end}}' | grep MYSQL_ROOT

# Start the server
pnpm dev   # API on :3001
```

### Project structure

```
src/
├── index.ts           # Hono app entry point
├── config.ts          # Environment config (requireEnv)
├── shared/            # Types, entities, API contracts
├── routes/            # Hono route modules
├── core/              # Business logic (agent, lifecycle, workspace)
├── db/                # MySQL pool, migrations, types
├── auth/              # Auth services
├── middleware/         # Auth + validation middleware
├── consumers/         # External message consumers (Slack)
└── observability/     # Audit logging
```

## Code style

All code rules are documented in `CLAUDE.md`. The key ones:

- **No `any` types.** Create interfaces for all DB results and API responses.
- **No env var fallbacks.** Use `requireEnv()` — it throws if missing.
- **New API routes need Zod validation.** Use `parseBody()` from `middleware/validate.ts`.

## Pull request process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Ensure TypeScript compiles: `npx tsc --noEmit`
4. Run tests: `pnpm test`
5. Open a PR against `main`

### PR checklist

- [ ] TypeScript compiles cleanly
- [ ] Tests pass
- [ ] No `as any` or `: any` types introduced
- [ ] New API routes have Zod input validation

## Commit messages

Use concise imperative form: "Add workspace validation", "Fix cost estimation for unknown models", "Remove hardcoded model ID".

## `.claude/` directory

The `.claude/` directory contains Claude Code configuration — skills (dev automation scripts), hooks, and settings. It's optional for development. You don't need Claude Code to contribute.

## Questions?

Open a [GitHub Discussion](https://github.com/NumstackPtyLtd/supaproxy-server/discussions) or file an issue.
