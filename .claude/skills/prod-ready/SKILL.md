---
name: prod-ready
description: >
  Checks server code for production safety and DDD architecture compliance.
  Catches insecure cookies, error leaks, missing auth, layer boundary
  violations, and hardcoded values. Run before deploying or merging to main.
---

# Prod Ready (Server)

Scan for code that works in dev but breaks, leaks, or violates DDD in production.

## Step 1: DDD Layer Violations (CRITICAL)

```bash
# Direct DB access outside infrastructure (MUST be zero)
grep -rn "getPool\|pool\.execute\|db\.execute" src/domain/ src/application/ src/presentation/ --include="*.ts"

# Infrastructure imports in domain or application (MUST be zero)
grep -rn "from '.*infrastructure" src/domain/ src/application/ --include="*.ts"

# Concrete instantiation outside container.ts (MUST be zero)
grep -rn "new Mysql\|new Bcrypt\|new Jwt\|new Anthropic\|new BullMq" src/ --include="*.ts" | grep -v container.ts
```

## Step 2: Cookie Security

```bash
grep -rn "secure:" src/ --include="*.ts" | grep -v node_modules
```

Every cookie must use `secure: IS_PRODUCTION`, never `secure: false`.

## Step 3: Error Messages That Leak Internals

```bash
grep -rn "stack\|__dirname\|process\.cwd" src/presentation/ --include="*.ts" | grep -v node_modules
```

Error responses to clients must be generic. Full errors logged with pino. Check that `app.onError` in `index.ts` returns a generic message.

## Step 4: Missing res.ok Checks on Outbound Fetch

```bash
grep -rn "\.json()" src/infrastructure/ --include="*.ts" | grep -v node_modules | grep -v "c\.json\|return.*json\|parseBody\|req\.json"
```

## Step 5: Missing Auth on Endpoints

```bash
grep -rn "\.get(\|\.post(\|\.put(\|\.delete(\|\.patch(" src/presentation/routes/ --include="*.ts"
grep -rn "requireAuth" src/presentation/routes/ --include="*.ts"
```

Every endpoint except `/health`, `/api/auth/*`, `/api/signup`, and `/api/models` must be behind `requireAuth`.

## Step 6: No Hardcoded Localhost

```bash
grep -rn "localhost" src/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md | grep -v ".env" | grep -v CLAUDE.md
```

## Step 7: Empty Catch Blocks

```bash
grep -rn "catch {}\|catch () {}\|\.catch(() => {})" src/ --include="*.ts" | grep -v node_modules
```

## Step 8: Debug Leftovers

```bash
grep -rn "console\.log" src/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md
grep -rn "TODO\|FIXME\|HACK" src/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md
```

## Step 9: Hardcoded Timeouts and Limits

```bash
grep -rn "setTimeout\|setInterval\|\.timeout\|delay:" src/ --include="*.ts" | grep -v node_modules | grep "[0-9]\{3,\}"
```

## Step 10: SQL Safety

```bash
grep -rn "execute(\`\|execute('" src/infrastructure/ --include="*.ts" | grep '\${'
```

## Report

Group findings:
- **CRITICAL**: Layer violations, insecure cookies, auth bypass, SQL injection, leaked internals
- **HIGH**: Missing res.ok, missing auth, empty catches, DIP violations
- **MEDIUM**: Debug code, magic numbers, console.logs
- **LOW**: Cosmetic

Fix all CRITICAL and HIGH before merging.
