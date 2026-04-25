#!/bin/bash
# Pre-commit quality gate for Lunar
# Blocks commits that introduce hardcoded values, provider leaks, or secrets

ERRORS=0
WARNINGS=0

# Get staged files
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|astro)$' | grep -v node_modules)

if [ -z "$STAGED" ]; then
  exit 0
fi

# 1. Check for hardcoded localhost URLs in components
LOCALHOST=$(echo "$STAGED" | xargs grep -ln "localhost:3001\|localhost:4322" 2>/dev/null | grep -v ".env\|SKILL.md\|CLAUDE.md")
if [ -n "$LOCALHOST" ]; then
  echo "BLOCKED: Hardcoded localhost URLs found:" >&2
  echo "$LOCALHOST" | while read f; do echo "  $f" >&2; done
  echo "  Use environment config instead of hardcoded URLs" >&2
  ERRORS=$((ERRORS + 1))
fi

# 2. Check for provider-specific references in UI/docs
PROVIDER=$(echo "$STAGED" | grep -E 'components/|pages/' | xargs grep -lin "anthropic\|claude-sonnet\|claude-opus\|claude-haiku\|sk-ant-" 2>/dev/null | grep -v "SKILL.md\|CLAUDE.md")
if [ -n "$PROVIDER" ]; then
  echo "BLOCKED: Provider-specific references in UI:" >&2
  echo "$PROVIDER" | while read f; do echo "  $f" >&2; done
  echo "  Use generic terms: 'AI provider', 'model tier', 'API key'" >&2
  ERRORS=$((ERRORS + 1))
fi

# 3. Check for committed secrets
SECRETS=$(echo "$STAGED" | xargs grep -ln "xoxb-[0-9]\|xapp-[0-9]\|sk-ant-api" 2>/dev/null | grep -v ".env.example\|SKILL.md")
if [ -n "$SECRETS" ]; then
  echo "BLOCKED: Possible secrets in staged files:" >&2
  echo "$SECRETS" | while read f; do echo "  $f" >&2; done
  ERRORS=$((ERRORS + 1))
fi

# 4. Agnosticism — consumer-specific logic outside registries
CONSUMER_LEAK=$(echo "$STAGED" | grep -E 'components/' | grep -v 'registries/' | xargs grep -ln "'slack'\|'whatsapp'\|'discord'\|'teams'" 2>/dev/null | grep -v "import.*registries\|SKILL.md")
if [ -n "$CONSUMER_LEAK" ]; then
  echo "BLOCKED: Consumer-specific literals outside registries:" >&2
  echo "$CONSUMER_LEAK" | while read f; do echo "  $f" >&2; done
  echo "  Move consumer logic to lib/registries/consumers.ts" >&2
  ERRORS=$((ERRORS + 1))
fi

# 5. Agnosticism — consumer-specific copy in components
CONSUMER_COPY=$(echo "$STAGED" | grep -E 'components/' | grep -v 'registries/' | xargs grep -lin "Slack channel\|WhatsApp number\|Discord server\|Teams channel\|Bind a Slack" 2>/dev/null | grep -v "SKILL.md")
if [ -n "$CONSUMER_COPY" ]; then
  echo "BLOCKED: Consumer-specific copy in components:" >&2
  echo "$CONSUMER_COPY" | while read f; do echo "  $f" >&2; done
  echo "  Consumer descriptions belong in the registry, not inline" >&2
  ERRORS=$((ERRORS + 1))
fi

# 6. Agnosticism — AI provider names in broader scope (beyond just UI)
AI_PROVIDER=$(echo "$STAGED" | grep -v "SKILL.md\|CLAUDE.md\|package.json\|pnpm-lock\|.env" | xargs grep -lin "openai\|gemini\|llama\|mistral\|cohere" 2>/dev/null | grep -E 'components/|pages/|hooks/|lib/')
if [ -n "$AI_PROVIDER" ]; then
  echo "BLOCKED: AI provider names in frontend code:" >&2
  echo "$AI_PROVIDER" | while read f; do echo "  $f" >&2; done
  echo "  Say 'AI provider' or 'language model', not brand names" >&2
  ERRORS=$((ERRORS + 1))
fi

# 7. Check for new 'any' types (warning only)
NEW_ANY=$(echo "$STAGED" | xargs grep -n ": any\|as any" 2>/dev/null | grep "^+" | head -5)
if [ -n "$NEW_ANY" ]; then
  echo "WARNING: New 'any' types detected. Consider adding proper types." >&2
  WARNINGS=$((WARNINGS + 1))
fi

# 8. Check for empty catch blocks
EMPTY_CATCH=$(echo "$STAGED" | xargs grep -ln "catch {}\|catch () {}\|\.catch(() => {})" 2>/dev/null)
if [ -n "$EMPTY_CATCH" ]; then
  echo "WARNING: Empty catch blocks found:" >&2
  echo "$EMPTY_CATCH" | while read f; do echo "  $f" >&2; done
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
