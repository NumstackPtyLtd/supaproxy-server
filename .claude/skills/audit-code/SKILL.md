---
name: audit-code
description: >
  Comprehensive server code quality audit. Finds security issues, type safety
  violations, dead code, magic numbers, missing error handling, architecture
  violations, and provider agnosticism issues. Run before PRs or periodically.
---

# Code Audit (Server)

Run a comprehensive quality scan across the SupaProxy server codebase. Report findings grouped by severity.

## Step 1: Sub-Audits

Run these skill audits first -- they have their own detailed checks:

- `/no-defaults` -- env var fallbacks
- `/prod-ready` -- production safety (cookies, error leaks, auth, res.ok)

## Step 2: Provider-Specific References

Server code and API responses must be provider-agnostic.

```bash
# Provider names in server code (outside of SDK/client instantiation)
grep -rn "claude\|anthropic\|sonnet\|haiku\|opus\|openai\|gpt-" apps/server/src/ --include="*.ts" -i | grep -v node_modules | grep -v SKILL.md | grep -v CLAUDE.md | grep -v "import.*from\|require("

# Provider-specific token format placeholders
grep -rn "xoxb-\|xapp-\|sk-ant-\|sk-proj-" apps/server/src/ packages/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md
```

Model IDs come from the DB, never hardcoded. Token placeholders should be generic (e.g. "paste your token").

## Step 3: Type Safety

```bash
# any types (target: zero)
echo "=== any types ===" && grep -rn ": any\|as any\|<any>\|= any" apps/server/src/ packages/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts" | wc -l

# Worst offenders
grep -rn ": any\|as any\|<any>" apps/server/src/ packages/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts" | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -10
```

Target: zero `any` types. Every DB result must use a typed row interface extending `RowDataPacket`.

## Step 4: Duplicate Type Definitions

```bash
# Find interfaces/types defined in multiple files
grep -rn "^interface \|^export interface \|^type \|^export type " apps/server/src/ packages/ --include="*.ts" | grep -v node_modules | awk -F: '{print $2}' | sed 's/export //' | sort | uniq -d
```

Types shared across routes should be defined ONCE in `db/types.ts` or `@supaproxy/shared` and imported.

## Step 5: Dead Code & Unused Exports

```bash
# Deprecated functions
grep -rn "@deprecated" apps/server/src/ packages/ --include="*.ts" | grep -v node_modules

# Unused imports (basic check)
grep -rn "^import " apps/server/src/ --include="*.ts" | grep -v node_modules | head -20
```

For each deprecated export, check if anything still imports it. Remove if unused.

## Step 6: Error Handling

```bash
# Empty catch blocks
grep -rn "catch {}\|catch () {}\|\.catch(() => {})\|catch {\s*}" apps/server/src/ --include="*.ts" | grep -v node_modules

# Catch blocks that swallow error details
grep -rn "catch" apps/server/src/ --include="*.ts" -A 2 | grep -v "log\.\|throw\|pino\|console" | grep -v node_modules

# Missing res.ok checks on outbound fetch
grep -rn "\.json()" apps/server/src/ --include="*.ts" | grep -v node_modules | grep -v "c\.json\|return.*json\|parseBody\|req\.json"
```

Rules:
- Every `.catch()` must log the actual error with pino, not a generic string
- Every outbound `fetch().then(r => r.json())` must check `res.ok` first
- No empty catch blocks

## Step 7: Magic Numbers

```bash
# Hardcoded timeouts/intervals
grep -rn "setTimeout\|setInterval\|\.timeout\|delay:" apps/server/src/ --include="*.ts" | grep -v node_modules | grep "[0-9]\{3,\}"

# Hardcoded limits
grep -rn "slice(0,\|\.slice(-\|limit:" apps/server/src/ --include="*.ts" | grep -v node_modules | grep "[0-9]"
```

Every timeout, interval, limit, and threshold must be a named constant:
```typescript
const POLL_INTERVAL_MS = 3000;
const MAX_TOOL_ROUNDS = 10;
```

## Step 8: Architecture Violations

```bash
# Business logic in route handlers (should be in core/)
# Look for complex DB queries or multi-step operations directly in routes
wc -l apps/server/src/routes/*.ts | sort -rn | head -10

# Route handlers should be thin: validate input, call service, return JSON
# Files over 200 lines likely have business logic that should move to core/

# Direct pool.execute in routes (acceptable for simple queries, but complex logic should be in services)
grep -rn "pool\.execute\|db\.execute" apps/server/src/routes/ --include="*.ts" | grep -v node_modules | wc -l
```

## Step 9: SQL Safety

```bash
# String interpolation in SQL queries (must use parameterized ?)
grep -rn "execute(\`\|execute('" apps/server/src/ --include="*.ts" | grep -v node_modules | grep '\${'
```

All SQL must use parameterized queries. Never interpolate variables into SQL strings.

## Step 10: Consumer Architecture

```bash
# Consumer files should follow the pattern in consumers/slack.ts
ls -la apps/server/src/consumers/

# Each consumer must:
# 1. Import and call runAgent from core/agent.ts
# 2. Look up workspace by channel/endpoint
# 3. Handle errors and log with pino
grep -rn "runAgent" apps/server/src/consumers/ --include="*.ts" | grep -v node_modules
```

## Step 11: Package Boundaries

```bash
# Server code importing from packages correctly
grep -rn "from '@supaproxy/" apps/server/src/ --include="*.ts" | grep -v node_modules

# Packages should not import from apps/server
grep -rn "from '.*apps/server\|from '.*\.\.\/\.\.\/apps" packages/ --include="*.ts" | grep -v node_modules
```

`@supaproxy/shared` and `@supaproxy/sdk` must not import from the server app. Dependencies flow: server -> packages, never the reverse.

## Report Format

Group findings by severity:
- **CRITICAL**: Security (SQL injection, auth bypass, secrets), missing auth
- **HIGH**: Type safety (`any`), dead code, missing error handling, architecture violations
- **MEDIUM**: Magic numbers, duplicated types, provider leaks
- **LOW**: Naming, style, documentation

For each finding: file, line, what is wrong, what it should be.

End with an action plan prioritised by impact.
