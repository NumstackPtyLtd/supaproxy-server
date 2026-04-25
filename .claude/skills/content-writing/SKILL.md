---
name: content-writing
description: >
  Writing standards for all Supaproxy content: docs, UI text, commit messages,
  comments. Enforces language and formatting rules. Check before publishing
  any user-facing text.
---

# Content Writing

## Language

- **British English** — colour, organise, behaviour, licence (noun), practise (verb)
- **No em dashes** (—). Use a hyphen (-) or rewrite the sentence
- **No en dashes** (–). Use "to" for ranges: "10 to 20", not "10–20"
- **No smart quotes** (" " ' '). Use straight quotes (" ' )
- **No ellipsis character** (…). Use three dots (...) or rewrite

## Tone

- Direct. Say what it does, not what it could do
- No marketing language. No "powerful", "seamless", "cutting-edge"
- No exclamation marks in docs or UI
- Explain once, clearly. Don't repeat the same point in different words
- Use "you" not "the user" or "one"

## Formatting

- Headings: sentence case ("Add a connection", not "Add a Connection")
- Lists: no full stops at the end of list items unless they're full sentences
- Code: use backticks for inline code, code blocks for multi-line
- Tables: keep them narrow. If a table has more than 5 columns, reconsider
- Links: descriptive text, not "click here"

## Common fixes

| Wrong | Right |
|---|---|
| — (em dash) | - (hyphen) or rewrite |
| utilise | use |
| in order to | to |
| it is important to note that | (delete, just say the thing) |
| please note | (delete) |
| leverage | use |
| ensures that | ensures |
| in terms of | for / about |
| as well as | and |
| however | but (or start a new sentence) |

## When to run

- Before publishing any docs page
- Before writing UI copy (buttons, labels, descriptions, error messages)
- Before writing commit messages
- When reviewing existing content for consistency

## Checking existing files

```bash
# Find em dashes in content files
grep -rn '—\|–' apps/web/src/pages/docs/ apps/web/src/components/ apps/web/src/pages/login.astro
```

Fix every occurrence. No exceptions.
