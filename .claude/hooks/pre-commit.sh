#!/bin/bash
# Pre-commit quality gate for SupaProxy server
# Blocks commits that introduce hardcoded values, provider leaks, or secrets
# Only checks .ts files (server-only repo)

ERRORS=0
WARNINGS=0

# Get staged .ts files only (no .tsx, .astro -- this is a server repo)
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.ts$' | grep -v node_modules)

if [ -z "$STAGED" ]; then
  exit 0
fi

# 1. Check for hardcoded localhost URLs
LOCALHOST=$(echo "$STAGED" | xargs grep -ln "localhost:3001\|localhost:3308\|localhost:6380\|localhost:4322" 2>/dev/null | grep -v ".env\|SKILL.md\|CLAUDE.md\|\.example")
if [ -n "$LOCALHOST" ]; then
  echo "BLOCKED: Hardcoded localhost URLs found:" >&2
  echo "$LOCALHOST" | while read f; do echo "  $f" >&2; done
  echo "  Use environment config (requireEnv) instead of hardcoded URLs" >&2
  ERRORS=$((ERRORS + 1))
fi

# 2. Check for provider-specific token formats
PROVIDER_TOKENS=$(echo "$STAGED" | xargs grep -ln "sk-ant-\|xoxb-[0-9]\|xapp-[0-9]\|sk-proj-" 2>/dev/null | grep -v "SKILL.md\|CLAUDE.md\|\.example\|\.env")
if [ -n "$PROVIDER_TOKENS" ]; then
  echo "BLOCKED: Provider-specific token formats found:" >&2
  echo "$PROVIDER_TOKENS" | while read f; do echo "  $f" >&2; done
  echo "  Use generic placeholders, not provider-specific token formats" >&2
  ERRORS=$((ERRORS + 1))
fi

# 3. Check for committed secrets (actual token patterns, not just prefixes)
SECRETS=$(echo "$STAGED" | xargs grep -ln "xoxb-[0-9]\{10,\}\|xapp-[A-Z0-9]\{10,\}\|sk-ant-api[0-9a-zA-Z]\{20,\}" 2>/dev/null | grep -v ".env.example\|SKILL.md")
if [ -n "$SECRETS" ]; then
  echo "BLOCKED: Possible secrets in staged files:" >&2
  echo "$SECRETS" | while read f; do echo "  $f" >&2; done
  ERRORS=$((ERRORS + 1))
fi

# 4. Check for AI provider names in server output (routes, consumers)
AI_PROVIDER=$(echo "$STAGED" | grep -E 'routes/|consumers/' | xargs grep -lin "anthropic\|openai\|gemini\|mistral\|cohere" 2>/dev/null | grep -v "import.*from\|require(\|SKILL.md\|CLAUDE.md\|package.json")
if [ -n "$AI_PROVIDER" ]; then
  echo "BLOCKED: AI provider names in server output code:" >&2
  echo "$AI_PROVIDER" | while read f; do echo "  $f" >&2; done
  echo "  Say 'AI provider' or 'language model', not brand names" >&2
  ERRORS=$((ERRORS + 1))
fi

# 5. Check for new 'any' types (warning only)
NEW_ANY=$(echo "$STAGED" | xargs grep -n ": any\|as any" 2>/dev/null | grep -v "node_modules\|.d.ts\|SKILL.md" | head -5)
if [ -n "$NEW_ANY" ]; then
  echo "WARNING: 'any' types detected. Consider adding proper interfaces." >&2
  echo "$NEW_ANY" | while read line; do echo "  $line" >&2; done
  WARNINGS=$((WARNINGS + 1))
fi

# 6. Check for empty catch blocks (warning only)
EMPTY_CATCH=$(echo "$STAGED" | xargs grep -ln "catch {}\|catch () {}\|\.catch(() => {})" 2>/dev/null | grep -v node_modules)
if [ -n "$EMPTY_CATCH" ]; then
  echo "WARNING: Empty catch blocks found:" >&2
  echo "$EMPTY_CATCH" | while read f; do echo "  $f" >&2; done
  echo "  Every catch must log the error with pino or propagate it" >&2
  WARNINGS=$((WARNINGS + 1))
fi

if [ $ERRORS -gt 0 ]; then
  echo "" >&2
  echo "Commit blocked: $ERRORS error(s), $WARNINGS warning(s)" >&2
  echo "Run /audit-code for full details" >&2
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo "Commit allowed with $WARNINGS warning(s)" >&2
fi

exit 0
