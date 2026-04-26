---
name: prod-ready
description: >
  Checks server code for patterns that break in production. Catches insecure
  cookies, error responses that leak internals, missing auth on endpoints,
  hardcoded localhost, empty catch blocks, and missing res.ok checks on
  outbound fetch. Run before deploying or merging to main.
---

# Prod Ready (Server)

Scan for server code that works in dev but breaks, leaks, or is exploitable in production.

## Step 1: Cookie Security

```bash
grep -rn "secure:" src/ --include="*.ts" | grep -v node_modules
```

Every cookie must use `secure: IS_PRODUCTION` (imported from config), never `secure: false`.

## Step 2: Error Messages That Leak Internals

```bash
grep -rn "stack\|__dirname\|process\.cwd" src/routes/ --include="*.ts" | grep -v node_modules
```

Error responses to clients must be generic. Full errors are logged server-side with pino. Never send stack traces, file paths, or SQL error messages in JSON responses.

Check that the global `app.onError` handler in `index.ts` returns a generic message and logs the real error.

## Step 3: Missing res.ok Checks on Outbound Fetch

```bash
# Find .json() calls in server code that might not check res.ok first
grep -rn "\.json()" src/ --include="*.ts" | grep -v node_modules | grep -v "c\.json\|return.*json\|parseBody\|req\.json"
```

Every outbound `fetch().then(r => r.json())` in server code must check `res.ok` before parsing:
```typescript
const res = await fetch(url);
if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
const data = await res.json();
```

## Step 4: Missing Auth on Endpoints

```bash
# Routes that don't use requireAuth (check each is intentionally public)
grep -rn "router\.\(get\|post\|put\|delete\|patch\)(" src/routes/ --include="*.ts" | grep -v node_modules
grep -rn "requireAuth" src/routes/ --include="*.ts" | grep -v node_modules
```

Every endpoint except `/health`, `/api/auth/*`, `/api/signup`, and `/api/models` must be behind `requireAuth`.

## Step 5: No Hardcoded Localhost in Runtime Output

```bash
grep -rn "localhost" src/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md | grep -v ".env" | grep -v "\.example" | grep -v "// " | grep -v CLAUDE.md
```

Logs, error messages, and responses must not contain hardcoded localhost URLs. Use env-derived values.

## Step 6: Empty Catch Blocks

```bash
grep -rn "catch {}\|catch () {}\|\.catch(() => {})\|catch {\s*}" src/ --include="*.ts" | grep -v node_modules
```

Every catch block must log the error with pino or propagate it. No silent swallowing.

## Step 7: Debug Leftovers

```bash
# console.log (should use pino logger or be removed)
grep -rn "console\.log" src/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md

# TODO/FIXME/HACK
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md
```

Server code must use the pino logger (`log.info`, `log.warn`, `log.error`), not `console.log`.

## Step 8: Hardcoded Timeouts and Limits

```bash
grep -rn "setTimeout\|setInterval\|\.timeout\|delay:" src/ --include="*.ts" | grep -v node_modules | grep "[0-9]\{3,\}"
```

Every timeout, interval, limit, and threshold must be a named constant:
```typescript
const AGENT_TIMEOUT_MS = 30000;
const MAX_TOOL_ROUNDS = 10;
```

## Step 9: SQL Injection Surface

```bash
# String concatenation in SQL (should use parameterized queries)
grep -rn "execute(\`\|execute('" src/ --include="*.ts" | grep -v node_modules | grep '\${'
```

All SQL must use parameterized queries with `?` placeholders. Never interpolate variables into SQL strings.

## Report

Group findings:
- **CRITICAL**: Insecure cookies, auth bypass, SQL injection, leaked internals
- **HIGH**: Missing res.ok, hardcoded localhost, missing auth, empty catches
- **MEDIUM**: Debug code, TODOs, console.logs, magic numbers
- **LOW**: Cosmetic

Fix all CRITICAL and HIGH before merging.
