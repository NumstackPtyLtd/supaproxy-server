---
name: agnosticism
description: >
  Enforces provider and client agnosticism across the entire codebase.
  Catches hardcoded provider names, client-specific logic, locked-in
  integrations, and non-generic patterns. Run periodically or before
  PRs to ensure SupaProxy stays open and pluggable.
---

# Agnosticism Audit

SupaProxy is an open-source AI operations platform. Any company, any AI provider, any messaging client. This skill enforces that principle across code, UI, docs, skills, and architecture.

## Step 1: AI Provider Leaks

No code should assume a specific AI provider.

```bash
echo "=== Provider names in code ==="
grep -rn "anthropic\|openai\|claude\|gpt-\|gemini\|llama\|mistral\|cohere" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.astro" -i | grep -v node_modules | grep -v SKILL.md | grep -v CLAUDE.md | grep -v ".env" | grep -v "package.json" | grep -v "pnpm-lock"

echo ""
echo "=== Provider-specific token formats ==="
grep -rn "sk-ant-\|sk-proj-\|xoxb-\|xapp-\|xoxp-" apps/ --include="*.ts" --include="*.tsx" --include="*.astro" | grep -v node_modules | grep -v SKILL.md | grep -v ".env"

echo ""
echo "=== Hardcoded model IDs ==="
grep -rn "claude-\|gpt-4\|gpt-3\|gemini-\|llama-\|mistral-" apps/web/src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v SKILL.md | grep -v CLAUDE.md
```

Rules:
- Say "AI provider", "language model", "model" — never a brand name
- Token placeholders: `"paste your API key"` or `"sk-..."` — never `"sk-ant-..."` or `"xoxb-..."`
- Model IDs come from the API/config, never inline in UI code

## Step 2: Client/Consumer Leaks

No component or route should contain logic specific to one consumer type.

```bash
echo "=== Consumer-specific logic in components ==="
grep -rn "=== 'slack'\|=== 'whatsapp'\|=== 'discord'\|=== 'teams'" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v registries

echo ""
echo "=== Consumer-specific copy in components ==="
grep -rn "Slack channel\|WhatsApp number\|Discord server\|Teams channel\|Bind a Slack\|Slack bot" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v registries

echo ""
echo "=== Consumer type literals outside registries ==="
grep -rn "'slack'\|'whatsapp'\|'discord'\|'teams'" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "import.*registries\|from.*registries"

echo ""
echo "=== Inline SVG icons for consumers (should be in registry) ==="
grep -rn "<svg" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "shared/\|icons/" | grep -iv "chevron\|arrow\|close\|check\|filter\|warning\|alert\|zap\|plus\|x\|search"
```

Rules:
- Consumer types, labels, icons, descriptions, and form fields live in `lib/registries/consumers.ts`
- Components read from the registry — zero inline consumer-specific logic
- Adding a new consumer (Teams, Discord, Telegram) = editing ONE file
- Consumer-specific copy (e.g., "Bind a Slack channel") lives in the registry's `description` field

## Step 3: Backend Consumer Coupling

```bash
echo "=== Consumer-specific route files ==="
ls apps/server/src/routes/ | grep -iv "auth\|org\|workspace\|connector\|conversation\|query\|queue"

echo ""
echo "=== Consumer-specific imports in core ==="
grep -rn "slack\|whatsapp\|discord\|teams" apps/server/src/core/ --include="*.ts" | grep -v node_modules

echo ""
echo "=== Hardcoded consumer logic in routes ==="
grep -rn "'slack'\|'whatsapp'\|'discord'" apps/server/src/routes/ --include="*.ts" | grep -v node_modules
```

Rules:
- Consumer implementations live in `apps/server/src/consumers/` — one file per type
- Core agent logic (`core/agent.ts`) must be consumer-agnostic — it receives a query and context, doesn't know the source
- Routes in `routes/connectors.ts` handle consumer setup generically where possible
- Consumer-specific setup routes (e.g., Slack channel binding) are acceptable but should be minimal

## Step 4: Skills and Documentation

```bash
echo "=== Provider-specific skill names ==="
ls .claude/skills/ | grep -i "slack\|whatsapp\|discord\|anthropic\|openai\|claude"

echo ""
echo "=== Provider names in docs ==="
grep -rn "Slack\|WhatsApp\|Discord\|Teams\|Anthropic\|OpenAI\|Claude" apps/web/src/pages/docs/ --include="*.astro" | grep -v node_modules | grep -v "AI provider\|language model\|messaging client\|consumer"
```

Rules:
- Skill names are generic: `/debug-clients` not `/debug-slack`
- Docs reference "AI provider", "messaging client", "consumer" — not brand names
- When docs need examples, use multiple providers: "Slack, Teams, or WhatsApp" — never just one

## Step 5: Architecture Check

The system should be pluggable at every layer:

```bash
echo "=== AI provider abstraction ==="
grep -rn "import.*anthropic\|import.*openai\|require.*anthropic\|require.*openai" apps/server/src/ --include="*.ts" | grep -v node_modules

echo ""
echo "=== Consumer registry completeness ==="
cat apps/web/src/lib/registries/consumers.ts | grep "CONSUMER_TYPES"

echo ""
echo "=== Connection types ==="
cat apps/web/src/lib/registries/connections.ts | grep "CONNECTION_TYPES"
```

Verify:
- AI provider is behind an abstraction (model config, not hardcoded SDK import)
- Consumer registry is the single source of truth for all consumer types
- Connection registry covers all supported connection types
- Adding a new AI provider, consumer, or connection type doesn't require editing more than 2-3 files

## Step 6: Error Messages and Logs

```bash
echo "=== Provider-specific error messages ==="
grep -rn "Slack.*error\|WhatsApp.*error\|Anthropic.*error\|OpenAI.*error" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v SKILL.md | grep -v ".test."

echo ""
echo "=== Provider names in user-facing strings ==="
grep -rn "Slack\|WhatsApp\|Anthropic\|OpenAI" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v registries | grep -v SKILL
```

Rules:
- Error messages to users: "Consumer failed to connect" not "Slack bot failed"
- Log messages can be specific (for debugging) but user-facing UI must be generic
- The only place provider names appear in the UI is inside registry metadata (labels, icons)

## Report Format

Group findings:
- **CRITICAL**: Provider lock-in in core logic (agent, routing, auth)
- **HIGH**: Provider names in UI components or user-facing strings
- **MEDIUM**: Provider-specific skills, docs, or error messages
- **LOW**: Provider names in internal logs (acceptable for debugging)

For each finding: file, line, what's wrong, what it should be.

End with a score: `X/Y checks passed` and list of files that need changes.
