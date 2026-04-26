---
name: no-defaults
description: >
  Enforces that environment variables are required with no silent fallbacks.
  Catches patterns like || 'http://localhost', || 'some-default', and
  process.env.X ?? 'fallback'. Run after any code change that touches
  config, env vars, or server setup.
---

# No Defaults

Environment variables must be required. Silent fallbacks hide misconfiguration and cause production incidents.

## The rule

Every `process.env.X` access must either:
1. Go through `requireEnv()` which throws if missing, OR
2. Be used with an explicit check that throws/errors before use

**Never** write:
```typescript
// BAD -- silent fallback
const API_URL = process.env.API_URL || 'http://localhost:3001'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:4322'
```

**Always** write:
```typescript
// GOOD -- fails fast
const API_URL = requireEnv('API_URL')
const JWT_SECRET = requireEnv('JWT_SECRET')
```

Where `requireEnv` is defined in `src/config.ts`:
```typescript
const requireEnv = (name: string): string => {
  const val = process.env[name]
  if (!val) throw new Error(
    `Missing required environment variable: ${name}. ` +
    `Add it to your .env file (see .env.example for reference).`
  )
  return val
}
```

## Audit

Search for violations:

```bash
# Fallback patterns in server code
grep -rn "process\.env\.\w* ||" src/ --include="*.ts" | grep -v node_modules | grep -v '.env'
grep -rn "process\.env\.\w* \?\?" src/ --include="*.ts" | grep -v node_modules | grep -v '.env'

# Fallback patterns in packages
grep -rn "process\.env\.\w* ||" --include="*.ts" | grep -v node_modules
grep -rn "process\.env\.\w* \?\?" --include="*.ts" | grep -v node_modules

# Hardcoded localhost anywhere
grep -rn "http://localhost" apps/ --include="*.ts" | grep -v node_modules | grep -v SKILL.md | grep -v ".env"
```

## Exceptions

- `process.env.NODE_ENV ?? 'development'` is acceptable -- NODE_ENV has a well-known convention.
- `process.env.DASHBOARD_URL || ''` is acceptable -- optional when running headless.
- `process.env.DEFAULT_MODEL || ''` is acceptable -- model is set per-workspace.
- `process.env.SUPAPROXY_LOG_DIR || './var/logs'` is acceptable -- logging directory has a sensible default.

## When you find a violation

1. Remove the fallback
2. Use `requireEnv()` from `src/config.ts`
3. Add the variable to `.env.example` with a placeholder value
4. Verify the `.env` file has the real value set

## When to run

- After any code that reads environment variables
- After adding a new config value
- Before PRs (part of `/audit-code`)
