# Add Knowledge Sources

Knowledge sources provide the AI with context it can't get from tools -- domain rules, process docs, team conventions. This guide covers adding each source type.

## Wiki pages

### Step 1: Identify useful pages

Good knowledge sources:

- Service overviews and architecture docs
- Process runbooks and SOPs
- Business rules and regional differences
- FAQ pages and known-issue lists
- Onboarding docs (what a new team member needs to know)

Bad knowledge sources (avoid):

- Meeting notes (noisy, outdated quickly)
- Sprint boards or ticket lists (stale)
- Raw API specs (better as a REST connection)
- Entire spaces without filtering (too much noise)

### Step 2: Add via the dashboard

Go to the **Knowledge** tab in your workspace. Click **Add source**, select **Wiki / Confluence**, and specify the space key and page titles:

```
Space: ENG
Pages:
  - "1. Service Overview"
  - "3. Key Flows"
  - "4. Onboarding Guide"
```

You can specify individual pages (recommended) or an entire space (noisy).

### Step 3: Verify indexing

After adding, check the Knowledge tab. Each source shows:

- **Status**: synced, pending, or error
- **Chunks**: how many segments were indexed
- **Last synced**: when it was last fetched

If chunks is 0 or status is error, check that the wiki credentials are configured and the page title matches exactly.

---

## Files

Upload Markdown, text, or PDF files via the dashboard.

```
Files:
  - onboarding-guide.md
  - process-flows.md
  - team-conventions.md
```

Files are re-indexed when their modification timestamp changes.

### Tips

- Architecture and convention docs are often the single best knowledge source
- Business logic maps and flow diagrams convert well to indexed text
- Keep files under 50KB for efficient chunking. Larger files work but produce more chunks

---

## Inline text

Small, stable context that doesn't need a separate file. Business rules, team glossaries, status code meanings.

```
Inline content:
  Region differences:
  - EMEA: bank transfer payments, recurring references
  - APAC: card payments, one-time references

  Status meanings:
  - PENDING: awaiting first payment
  - ACTIVE: in good standing
  - LAPSED: missed payment, service suspended
  - CANCELLED: terminated by customer
```

Inline content is injected into the system prompt, not the vector index. It's always available, no retrieval step needed. Keep it short -- long inline text wastes prompt tokens on every query.

---

## How many sources is too many?

There's no hard limit, but more sources = more chunks = more vector search time per query. Guidelines:

| Workspace type | Typical sources | Typical chunks |
|---|---|---|
| Simple (one service) | 3-5 sources | 50-150 chunks |
| Medium (service + docs) | 5-10 sources | 150-400 chunks |
| Large (multi-service) | 10-20 sources | 400-1000 chunks |

If you're over 1000 chunks, consider splitting into multiple workspaces or being more selective about which pages to index.

---

## Removing a source

Use the Knowledge tab in the dashboard and click the remove button next to the source. The indexed chunks are cleaned up automatically.
