# Contributing to SupaProxy

Thanks for your interest in contributing! This guide will help you get started.

## Development setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for MySQL and Redis)

### Getting started

```bash
git clone https://github.com/NumstackPtyLtd/supaproxy.git
cd supaproxy
pnpm install

# Start MySQL + Redis
docker compose up -d

# Configure environment
cp apps/server/.env.example apps/server/.env
# Generate a JWT secret and set DB_PASSWORD
openssl rand -hex 32  # paste as JWT_SECRET

# Start the server
pnpm --filter @supaproxy/server dev   # API on :3001
```

### Project structure

```
apps/server/     # Hono backend (API, agent, consumers)
packages/sdk/    # TypeScript API client
packages/shared/ # Shared types and entities
```

## Code style

All code rules are documented in `CLAUDE.md`. The key ones:

- **No `any` types.** Create interfaces for all DB results and API responses.
- **No env var fallbacks.** Use `requireEnv()` — it throws if missing.
- **New API routes need Zod validation.** Use `parseBody()` from `middleware/validate.ts`.

## Pull request process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Build shared packages: `pnpm --filter @supaproxy/shared build`
4. Ensure TypeScript compiles: `npx tsc --noEmit -p apps/server/tsconfig.json`
5. Run tests: `pnpm test`
6. Open a PR against `main`

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

Open a [GitHub Discussion](https://github.com/NumstackPtyLtd/supaproxy/discussions) or file an issue.
