---
name: rebrand
description: >
  Finds and fixes legacy naming from previous project names. Renames
  @reclaim/* to @supaproxy/*, reclaim_session to supaproxy_session,
  and any other stale references. Run when encountering old names or
  periodically to catch drift.
---

# Rebrand

The project was renamed from Reclaim to SupaProxy. Legacy references cause confusion and break imports.

## Step 1: Package references

```bash
# Old package scope
grep -rn "@reclaim/" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules

# Old package names in package.json
grep -rn "reclaim" apps/*/package.json packages/*/package.json 2>/dev/null
```

Fix: replace `@reclaim/` with `@supaproxy/` everywhere.

## Step 2: Cookie names

```bash
grep -rn "reclaim_session" apps/ --include="*.ts" --include="*.tsx" --include="*.astro" | grep -v node_modules
```

Fix: replace with `supaproxy_session`.

## Step 3: Variable and function names

```bash
# Any remaining "reclaim" in variable names, comments, strings
grep -rn -i "reclaim" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.astro" --include="*.json" | grep -v node_modules | grep -v SKILL.md | grep -v ".git"
```

Fix: rename to supaproxy equivalent. Use judgement — some may be in user-facing strings that need updating.

## Step 4: File and directory names

```bash
find apps/ packages/ -name "*reclaim*" -not -path "*/node_modules/*"
```

Fix: rename files and update all imports.

## Step 5: Documentation and skills

```bash
grep -rn -i "reclaim" .claude/ docs/ --include="*.md" 2>/dev/null | grep -v node_modules
```

Fix: update all docs references.

## Step 6: Docker and config files

```bash
grep -rn -i "reclaim" docker-compose*.yml .env.example Dockerfile* 2>/dev/null
```

## After fixing

1. Run `npx tsc --noEmit` to verify no broken imports
2. Run `pnpm install` if package.json changed
3. Grep once more to confirm zero matches

## When to run

- When you encounter any `@reclaim/` import
- When you see `reclaim_session` in code
- Periodically as part of `/audit-code`
- After adding new code that might have been copied from old templates
