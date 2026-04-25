# Internal Development Guide

For Numstack team members working on SupaProxy.

## Repo structure

```
~/workspace/
├── supaproxy/              ← Public engine (MIT) — github.com/NumstackPtyLtd/supaproxy
│   ├── apps/server/        ← Hono API server
│   ├── packages/shared/    ← @supaproxy/shared (types, entities)
│   └── packages/sdk/       ← @supaproxy/sdk (TypeScript client)
│
└── supaproxy-dashboard/    ← Private frontend — github.com/NumstackPtyLtd/supaproxy-dashboard
    └── apps/web/           ← Astro + React dashboard
```

## First-time setup

```bash
# Clone both repos
cd ~/workspace
git clone git@github.com:NumstackPtyLtd/supaproxy.git
git clone git@github.com:NumstackPtyLtd/supaproxy-dashboard.git

# Start the engine (generates secrets, builds containers)
cd supaproxy
./init.sh

# API is now running at http://localhost:3001
```

## Running the dashboard locally

```bash
cd ~/workspace/supaproxy-dashboard
pnpm install

# Point dashboard at local API
echo "PUBLIC_SUPAPROXY_API_URL=http://localhost:3001" > apps/web/.env

pnpm dev
# Dashboard at http://localhost:4322
```

## Day-to-day development

### Engine changes (server, SDK, shared types)

```bash
cd ~/workspace/supaproxy
git checkout -b feature/my-change

# Edit server code
pnpm --filter @supaproxy/server dev    # Auto-reloads on save

# Run tests
pnpm test

# Typecheck
pnpm --filter @supaproxy/shared build
npx tsc --noEmit -p apps/server/tsconfig.json

# Push and create PR
git push -u origin feature/my-change
gh pr create
```

### Dashboard changes

```bash
cd ~/workspace/supaproxy-dashboard
git checkout -b feature/my-change

pnpm dev    # Hot reloads at http://localhost:4322

git push -u origin feature/my-change
gh pr create
```

### Changing shared types

If you modify `packages/shared/`, rebuild before the dashboard picks it up:

```bash
cd ~/workspace/supaproxy
pnpm --filter @supaproxy/shared build
```

Once published to npm, the dashboard will use the published version instead.

## Docker

```bash
# Rebuild after server changes
docker compose build --no-cache server
docker compose up -d server

# Reset everything (wipes DB)
docker compose down -v
./init.sh

# View logs
docker logs -f supaproxy-server
```

## Branch rules

- `main` is protected — all changes go through PRs
- PRs require 1 approval + CI passing (TypeScript, Tests, Build)
- No force pushes to main

## What goes where

| Change | Repo |
|--------|------|
| API endpoint | supaproxy |
| Database schema | supaproxy |
| Shared types | supaproxy (packages/shared) |
| SDK method | supaproxy (packages/sdk) |
| Consumer (Slack, API) | supaproxy |
| UI component | supaproxy-dashboard |
| Page / route | supaproxy-dashboard |
| Styles / branding | supaproxy-dashboard |
| Fonts | supaproxy-dashboard |
