# Type Registry

Replace scattered hardcoded type maps (consumer labels, channel icons, status colors) with single-source-of-truth registries.

## When to run
- When the same set of string literals (`'slack'`, `'api'`, `'whatsapp'`) appears in 2+ files
- When adding a new variant requires editing 3+ locations
- When `if/else` or `switch` chains map string types to UI elements

## Step 1: Find duplicated type maps

```bash
echo "=== Consumer type references ==="
grep -rn "'slack'\|'api'\|'whatsapp'\|'claude-code'" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | awk -F: '{print $1}' | sort | uniq -c | sort -rn

echo "=== Status references ==="
grep -rn "'open'\|'cold'\|'closed'\|'resolved'\|'escalated'" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | awk -F: '{print $1}' | sort | uniq -c | sort -rn

echo "=== Connection type references ==="
grep -rn "'mcp'\|'rest'\|'graphql'\|'database'" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | awk -F: '{print $1}' | sort | uniq -c | sort -rn
```

## Step 2: Create registries

Each registry lives in `apps/web/src/lib/registries/` and exports:
1. A **const union type** (not an enum)
2. A **metadata record** mapping each variant to ALL its UI properties
3. **Accessor functions** that take a type string and return the metadata

### Pattern

```ts
// apps/web/src/lib/registries/consumers.ts

import type { ComponentType } from 'react';

export const CONSUMER_TYPES = ['slack', 'api', 'whatsapp', 'cli'] as const;
export type ConsumerType = typeof CONSUMER_TYPES[number];

interface ConsumerMeta {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

export const CONSUMERS: Record<ConsumerType, ConsumerMeta> = {
  slack: { label: 'Slack', icon: SlackIcon },
  api: { label: 'API', icon: CodeIcon },
  whatsapp: { label: 'WhatsApp', icon: WhatsAppIcon },
  cli: { label: 'CLI', icon: TerminalIcon },
};

export function getConsumer(type: string): ConsumerMeta {
  return CONSUMERS[type as ConsumerType] ?? { label: type, icon: GlobeIcon };
}
```

### Registries to create

1. **`consumers.ts`** — consumer types, labels, icons
2. **`statuses.ts`** — conversation statuses, badge classes, colors
3. **`categories.ts`** — conversation categories, badge classes
4. **`connections.ts`** — connection types (MCP, REST, etc.), labels, icons, enabled state

## Step 3: Move icons into registries

- Extract inline SVGs (Slack, WhatsApp) into standalone icon components in `apps/web/src/components/icons/`
- Import them into the registry
- Delete the `ChannelIcon` if/else chain — replace with `getConsumer(type).icon`

## Step 4: Update all consumers

Every component that currently has:
```ts
{({'slack': 'Slack', 'api': 'API', ...})[type] || type}
```
Becomes:
```ts
import { getConsumer } from '../lib/registries/consumers';
// ...
{getConsumer(type).label}
```

Every `ChannelIcon` call becomes:
```ts
const { icon: Icon } = getConsumer(type);
<Icon size={14} />
```

## Step 5: Move consumer-specific copy into registry

Consumer descriptions, placeholder text, and form field configurations should live in the registry, not scattered across components:

```ts
// In consumers.ts registry
interface ConsumerMeta {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  description: string;            // e.g. "Bind a channel to this workspace"
  fields: ConsumerField[];        // form fields for AddConsumerModal
  placeholder?: string;           // e.g. "C0123456789" for Slack channel ID
}
```

This means `AddConsumerModal` reads form structure from the registry instead of hardcoding Slack/WhatsApp/API form layouts inline.

## Step 6: Remove inline SVG icons from components

```bash
# Inline SVG icons that belong in the registry (e.g., Slack logo in OrgSettings)
grep -rn "<svg" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "shared/\|icons/"
```

All consumer/integration SVG icons must live either in the registry (as React components) or in `components/icons/`. Zero inline SVGs for known consumer types in page components.

## Step 7: Ensure types are not duplicated as literals

```bash
# Consumer type literals hardcoded in component files (should import from registry)
grep -rn "'slack' | 'api' | 'whatsapp'\|type.*=.*'slack'\|'whatsapp'" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "import"
```

Component files must import `ConsumerType` from the registry, not redefine the union inline.

## Step 8: Verify

```bash
# No more inline consumer/status maps
grep -rn "slack.*Slack.*api.*API\|'slack': 'Slack'" apps/web/src/components/ --include="*.tsx" | grep -v registries | wc -l
# Should be 0

# No inline SVGs for known consumer types
grep -rn "<svg.*slack\|<svg.*whatsapp" apps/web/src/components/ --include="*.tsx" -i | grep -v node_modules | grep -v "registries\|icons/" | wc -l
# Should be 0

# No hardcoded consumer type unions in components
grep -rn "'slack' | 'api'" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | wc -l
# Should be 0

# No hardcoded consumer descriptions/copy
grep -rn "Bind a Slack\|Slack channel\|WhatsApp number" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | wc -l
# Should be 0
```

## Rules
- ONE file per registry, in `apps/web/src/lib/registries/`
- Every registry exports a `get[Type]()` function with a fallback for unknown values
- No `if/else` or `switch` chains for type → UI mapping in components
- Adding a new variant = editing ONE registry file — types, labels, icons, descriptions, form fields
- Registry types should be importable by backend too (consider `packages/shared/` if both need them)
- No inline SVG icons for known consumer types outside of registries/icons
- Consumer-specific copy (descriptions, placeholders) comes from the registry, not component code
