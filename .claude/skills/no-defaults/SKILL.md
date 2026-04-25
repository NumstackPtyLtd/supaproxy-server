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

Every `process.env.X` and `import.meta.env.X` access must either:
1. Go through `requireEnv()` which throws if missing, OR
2. Be used with an explicit check that throws/errors before use

**Never** write:
```typescript
// BAD — silent fallback
const API_URL = process.env.API_URL || 'http://localhost:3001'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:4322'
```

**Always** write:
```typescript
// GOOD — fails fast
const API_URL = requireEnv('API_URL')
const JWT_SECRET = requireEnv('JWT_SECRET')
```

Where `requireEnv` is defined in `apps/server/src/config.ts`:
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

For the Astro frontend, the same pattern applies with `import.meta.env`:
```typescript
// BAD
const API = import.meta.env.SUPAPROXY_API_URL || 'http://localhost:3001'

// GOOD — throw at module load so the build fails early
const API = import.meta.env.SUPAPROXY_API_URL
if (!API) throw new Error('Missing SUPAPROXY_API_URL env var')
```

## Audit

Search for violations:

```bash
# Fallback patterns in server code
grep -rn "process\.env\.\w* ||" apps/server/src/ --include="*.ts" | grep -v node_modules | grep -v '.env'
grep -rn "process\.env\.\w* \?\?" apps/server/src/ --include="*.ts" | grep -v node_modules | grep -v '.env' | grep -v "PORT"

# Fallback patterns in frontend code
grep -rn "import\.meta\.env\.\w* ||" apps/web/src/ --include="*.ts" --include="*.astro" --include="*.tsx" | grep -v node_modules

# Hardcoded localhost anywhere
grep -rn "http://localhost" apps/ --include="*.ts" --include="*.tsx" --include="*.astro" | grep -v node_modules | grep -v SKILL.md | grep -v ".env"
```

## Exception

`process.env.PORT ?? '3001'` is acceptable — PORT has a well-known convention and is the only env var where a fallback is tolerated.

## When you find a violation

1. Remove the fallback
2. Use `requireEnv()` for server code, or an explicit throw for frontend code
3. Add the variable to `.env.example` with a placeholder value
4. Verify the `.env` file has the real value set

## When to run

- After any code that reads environment variables
- After adding a new config value
- Before PRs (part of `/audit-code`)
