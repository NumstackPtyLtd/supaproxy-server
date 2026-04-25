# Unify Theme

Enforce a single theming system. Kill hardcoded hex values, fix duplication between CSS vars and JS theme objects, fix Astro layouts.

## When to run
- After writing any component with color values
- When reviewing components that mix `var(--x)`, `text-[#hex]`, and Tailwind color classes
- Periodically to catch drift

## Step 1: Audit hardcoded color values

```bash
echo "=== Hardcoded hex in TSX ==="
grep -rn 'text-\[#\|bg-\[#\|border-\[#' apps/web/src/components/ --include="*.tsx" | grep -v node_modules | wc -l

echo "=== Hardcoded hex in Astro layouts/pages ==="
grep -rn '#[0-9A-Fa-f]\{3,8\}' apps/web/src/layouts/ apps/web/src/pages/ --include="*.astro" | grep -v node_modules | grep -v "fill=\|stroke=" | wc -l

echo "=== Hardcoded Tailwind colors (should be semantic tokens) ==="
grep -rn 'text-red-\|text-amber-\|text-blue-\|bg-red-\|bg-orange-\|bg-green-\|text-green-' apps/web/src/components/ --include="*.tsx" | grep -v node_modules | wc -l

echo "=== Magic pixel values ==="
grep -rn 'text-\[1[0-9]px\]\|text-\[2[0-9]px\]\|max-w-\[.*%\]\|calc(.*[0-9]\{3\}' apps/web/src/components/ --include="*.tsx" | grep -v node_modules

echo "=== Worst offenders ==="
grep -rn 'text-\[#\|bg-\[#\|border-\[#\|color: #\|background: #\|border.*#\|text-red-\|text-amber-\|bg-red-\|bg-orange-' apps/web/src/ --include="*.tsx" --include="*.astro" | grep -v node_modules | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -10
```

## Step 2: The theming rules

### Allowed
- **CSS variables** from `global.css`: `var(--text-heading)`, `var(--border-color)`, `var(--bg-card)`, etc.
- **Tailwind semantic classes**: `text-white`, `bg-emerald-500/15`, `border-current`
- **Tailwind opacity modifiers** on semantic colors: `text-blue-600`, `bg-red-500/10`

### NOT allowed
- **Arbitrary hex in Tailwind**: `text-[#666]`, `bg-[#111]`, `border-[#222]`
- **Inline hex in style attributes**: `style={{ color: '#666' }}`
- **Inline hex in Astro `<style>` blocks**: `color: #a1a1a1` — use `var(--body)` instead
- **Hardcoded Tailwind colors for semantic meaning**: `text-red-600`, `bg-green-400`, `text-amber-600` when they represent status/severity — use CSS variables or registry classes instead
- **Magic pixel values**: `text-[10px]`, `text-[11px]`, `text-[15px]` — define a type scale in CSS variables or use standard Tailwind sizes
- **Magic calc values**: `calc(100vh - 200px)` — the `200px` must be a named CSS variable or constant
- **Mixed approaches** in the same component

### Special case: `lib/utils.ts` theme object
The `theme` object duplicates CSS variable values. It exists for JS-computed inline styles (e.g. `sentimentColour()`). Rules:
- Do NOT add new values to the theme object — use CSS vars in `style` props instead
- If a component only needs colors for `style` props, use `var(--x)` directly, not `theme.x`
- The theme object is acceptable for functions that compute colors (e.g. `sentimentColour`)

## Step 3: Replacement map

| Hardcoded | CSS variable |
|-----------|-------------|
| `#666`, `#666666` | `var(--text-muted)` |
| `#a1a1a1` | `var(--body)` |
| `#111`, `#111111` | `var(--bg-surface)` |
| `#222`, `#222222` | `var(--border-color)` |
| `#333` | `var(--border-light)` |
| `#444` | `var(--input-focus)` |
| `#0a0a0a` | `var(--bg-card)` |
| `#1a1a1a` | `var(--bg-hover)` |
| `#999` | `var(--text-muted)` |
| `#e0e0e0` | `var(--btn-primary-hover)` |
| `white` / `#ffffff` | `var(--text-heading)` |

## Step 4: Fix approach

### In `.tsx` components:
1. Replace `className="text-[#666]"` → `style={{ color: 'var(--text-muted)' }}`
2. Replace `className="bg-[#111]"` → `style={{ background: 'var(--bg-surface)' }}`
3. Replace `className="border-[#222]"` → `style={{ borderColor: 'var(--border-color)' }}`
4. Keep Tailwind for layout (`flex`, `gap-2`, `px-4`, `rounded-sm`)

### In `.astro` `<style>` blocks:
Replace hardcoded hex with CSS variables:
```css
/* BAD */
.prose-docs { color: #a1a1a1; }
.prose-docs code { background: #1a1a1a; border: 1px solid #222222; }

/* GOOD */
.prose-docs { color: var(--body); }
.prose-docs code { background: var(--bg-hover); border: 1px solid var(--border-color); }
```

### In `global.css`:
No light-mode override hacks (`[data-theme="light"] .bg-\[\#111\]`). These are only needed when components use hardcoded hex. Since components now use CSS vars directly, these overrides should be deleted.

## Step 5: Semantic color tokens for status/severity

Status and severity colors that appear in multiple components should use CSS variables or registry classes, not hardcoded Tailwind:

| Usage | Hardcoded | Should be |
|-------|-----------|-----------|
| Sentiment bar colors | `bg-red-400`, `bg-orange-400`, `bg-green-500` | CSS vars: `var(--sentiment-negative)`, or registry classes |
| Severity indicators | `text-red-600`, `text-amber-600`, `text-blue-600` | Registry: `getSeverityClass(level)` |
| Status pills | `bg-blue-500/15 text-blue-700` | Already in registry (good) — ensure ALL usage goes through it |

Define semantic CSS variables in `global.css`:
```css
--color-danger: ...;
--color-warning: ...;
--color-info: ...;
--color-success: ...;
```

## Step 6: Verify

```bash
# Should be zero
echo "=== Arbitrary hex in TSX ===" && grep -rn 'text-\[#\|bg-\[#\|border-\[#' apps/web/src/components/ --include="*.tsx" | grep -v node_modules | wc -l
echo "=== Arbitrary hex in Astro ===" && grep -rn '#[0-9A-Fa-f]\{3,8\}' apps/web/src/pages/ --include="*.astro" | grep -v node_modules | grep -v "fill=\|stroke=" | wc -l
echo "=== Astro style hex ===" && grep -rn 'color: #\|background: #\|border.*: .*#' apps/web/src/layouts/ --include="*.astro" | grep -v node_modules | grep -v "fill=\|stroke=" | wc -l
echo "=== CSS overrides ===" && grep -rn '\\\[#' apps/web/src/styles/ --include="*.css" | wc -l
echo "=== Magic pixel values ===" && grep -rn 'text-\[1[0-9]px\]\|text-\[2[0-9]px\]' apps/web/src/components/ --include="*.tsx" | grep -v node_modules | wc -l
```

## Rules
- One theming system: CSS variables via `style` props
- Tailwind color classes OK for semantic status indicators (`text-emerald-600`, `bg-red-500/10`)
- `text-white` is OK — it maps to heading color via CSS
- Never introduce new arbitrary hex values
- New colors go in `global.css` as CSS variables first
- Astro `<style>` blocks use CSS vars, not hardcoded hex
- No light-mode override hacks in `global.css` — they're a symptom of hardcoded hex
