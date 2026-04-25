---
name: restart-servers
description: >
  Restarts dev servers after code changes. Run automatically after
  ANY file edit, commit, or dependency change. The user should never
  see "connection refused".
---

# Restart Servers

## When to run
- After editing any file in `apps/server/`
- After editing any file in `apps/web/`
- After any `pnpm add/remove`
- After any commit
- Before telling the user a URL is ready
- **After changing Slack tokens in Settings** (consumer only starts at boot)

## Steps

### 1. Determine which servers changed

- `apps/server/**` changed — restart Hono
- `apps/web/**` changed — restart Astro
- `packages/**` changed — restart both
- `package.json` or `pnpm-lock.yaml` changed — restart both

### 2. Restart Hono (if needed)

**IMPORTANT:** Must run from `apps/server/` directory (needs `.env` file).

```bash
pkill -f "tsx.*index.ts" 2>/dev/null; sleep 1
cd apps/server && nohup ../../apps/server/node_modules/.bin/tsx src/index.ts > /tmp/supaproxy-server.log 2>&1 &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health
# Must be 200
```

After restart, verify Slack consumer started (if tokens are configured):
```bash
strings /tmp/supaproxy-server.log | grep -i "slack"
# Should show: "Bot user resolved" + "Slack consumer started"
```

### 3. Restart Astro (if needed)

```bash
pkill -f "astro dev" 2>/dev/null; sleep 1
cd apps/web && npx astro dev --port 4322 &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:4322
# Must be 200
```

### 4. Verify MySQL (if DB-related changes)

```bash
docker exec supaproxy-mysql mysql -u root -psupaproxy2026 supaproxy -e "SELECT 1" 2>&1 | tail -1
# Should return "1"
```

### 5. Report

Tell the user which servers were restarted and their health status.

## If a server fails to start

DO NOT tell the user the URL is ready. Read the error output, fix the issue, restart again, and only then report.
