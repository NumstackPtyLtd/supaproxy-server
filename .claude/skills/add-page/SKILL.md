---
name: add-page
description: >
  Adds a new page to the Astro frontend. Handles layout, header,
  footer, auth check, and data fetching from the Hono API.
  Use when building any new page.
---

# Add Page

## Step 1: Determine page type

- **Public page** (landing, docs, login) — no auth check needed
- **Protected page** (workspaces, dashboard, settings) — middleware handles redirect, use `Astro.locals.user`

## Step 2: Create the page file

Location: `apps/web/src/pages/{path}.astro`

Template for a **protected** page:
```astro
---
import Layout from '../layouts/Layout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

const user = (Astro.locals as any).user;

// API URL must come from env — no fallbacks
const API_URL = import.meta.env.SUPAPROXY_API_URL;
if (!API_URL) throw new Error('Missing SUPAPROXY_API_URL env var');

let data = null;
try {
  const res = await fetch(`${API_URL}/api/your-endpoint`, {
    headers: { cookie: Astro.request.headers.get('cookie') || '' },
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  data = await res.json();
} catch (err) {
  console.error('Failed to fetch data:', err);
}
---

<Layout title="Page Title - SupaProxy">
  <Header />
  <main class="pt-20 min-h-screen">
    <div class="max-w-[1000px] mx-auto px-6 py-12">
      <!-- Page content -->
    </div>
  </main>
  <Footer />
</Layout>
```

## Step 3: Style rules

- Use Tailwind classes — no hardcoded hex colours in components
- Font: Inter for body, JetBrains Mono for code
- Max width: `max-w-[1000px]`
- Cards: `bg-white border border-border rounded`
- Status badges: green for active, amber for pending, red for error
- Buttons: `rounded-sm`, primary colour from Tailwind config

## Step 4: If the page needs new API data

Run `/add-api-route` to create the backend endpoint FIRST. Verify it returns data, THEN build the Astro page that consumes it.

Never put database queries, auth logic, or business logic in the Astro page. Fetch from Hono.

## Step 5: Checklist before done

- [ ] No hardcoded API URLs — uses env var with throw if missing
- [ ] `res.ok` checked before `.json()`
- [ ] Catch block logs the error (not empty)
- [ ] Provider-agnostic — no AI vendor names in UI
- [ ] URL state — tabs/filters backed by URL params (run `/shareable-urls`)

## Step 6: Restart and verify

Run `/restart-servers` after creating the page. Verify the page loads at the expected URL.
