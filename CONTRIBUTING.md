# Contributing to SupaProxy

Thanks for your interest in contributing! This guide will help you get started.

## Development setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for MySQL and Redis)

### Getting started

```bash
git clone https://github.com/numstack/supaproxy.git
cd supaproxy
pnpm install

# Start MySQL + Redis
docker compose up -d

# Configure environment
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

# Generate a JWT secret
openssl rand -hex 32
# Paste it into apps/server/.env as JWT_SECRET
# Set DB_PASSWORD to match docker-compose.yaml

# Start dev servers
pnpm --filter @supaproxy/server dev   # Backend on :3001
pnpm --filter web dev                 # Dashboard on :4322
```

### Project structure

```
apps/server/     # Hono backend (API, agent, consumers)
apps/web/        # Astro frontend (dashboard)
packages/sdk/    # TypeScript SDK
packages/shared/ # Shared types
```

## Code style

All code rules are documented in `CLAUDE.md`. The key ones:

- **No `any` types.** Create interfaces for all DB results and API responses.
- **No env var fallbacks.** Use `requireEnv()` — it throws if missing.
- **Auth in Hono, rendering in Astro.** No auth logic in the frontend.
- **Max 200 lines per component.** Split into sub-components if needed.
- **Every fetch in useEffect needs AbortController.** Abort on cleanup.
- **No raw `setInterval`.** Use the `usePolling` hook.

## Pull request process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Ensure TypeScript compiles: `npx tsc --noEmit -p apps/server/tsconfig.json`
4. Run tests: `pnpm test`
5. Open a PR against `main`

### PR checklist

- [ ] TypeScript compiles cleanly
- [ ] Tests pass
- [ ] No `as any` or `: any` types introduced
- [ ] New API routes have Zod input validation
- [ ] New React islands wrapped in `<ErrorBoundary>`

## Commit messages

Use concise imperative form: "Add workspace validation", "Fix XSS in markdown renderer", "Remove hardcoded model ID".

## `.claude/` directory

The `.claude/` directory contains Claude Code configuration — skills (dev automation scripts), hooks, and settings. It's optional for development. You don't need Claude Code to contribute.

## Questions?

Open a [GitHub Discussion](https://github.com/numstack/supaproxy/discussions) or file an issue.
