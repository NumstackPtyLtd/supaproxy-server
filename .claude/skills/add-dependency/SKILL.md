---
name: add-dependency
description: >
  Evaluates and adds a new npm package. Tests it before committing.
  Prevents the auth-astro disaster from happening again.
---

# Add Dependency

## Before adding ANY package

### 1. Do we actually need it?

Ask:
- Can we build this with what we already have? (Hono, Astro, our own code)
- Is this a backend concern being solved in the frontend? (If yes, stop — put it in Hono)
- Is this a frontend concern being solved in the backend? (Rare, but check)

### 2. Check compatibility

```bash
# Check the package's latest version and peer deps
pnpm info {package-name} version peerDependencies

# Check if it works with our stack
# - Astro 6
# - Hono 4
# - Node 22+
# - TypeScript 5.9
```

### 3. Test before integrating

Create a minimal test in a temp file:
```typescript
// test-package.ts
import { whatever } from 'new-package';
// Try the core functionality
console.log(whatever());
```

Run it:
```bash
npx tsx test-package.ts
```

If it doesn't work in 15 minutes → build it yourself.

### 4. Install in the correct workspace

- Backend package → `pnpm --filter @supaproxy/server add {package}`
- Frontend package → `cd apps/web && pnpm add {package}`
- Shared → `cd packages/shared && pnpm add {package}`
- Dev dependency → add `-D` flag

**Never** install backend packages (MySQL, JWT, auth) in the frontend app.
**Never** install frontend packages (Astro plugins, React components) in the backend.

### 5. After installing

- Run `/restart-servers`
- Verify nothing broke
- Commit the `package.json` and `pnpm-lock.yaml` changes

## Red flags — DON'T use the package if:

- Last published > 6 months ago with open issues about your framework version
- Requires framework-specific integration files (like `auth.config.ts` at project root)
- Takes over routing, middleware, or request handling from your framework
- Has "experimental" or "alpha" in the version for core functionality you depend on
- You can't get a hello-world working in 15 minutes
