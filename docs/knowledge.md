# Knowledge

Knowledge sources give the AI context beyond what tools return. When the AI doesn't have a tool for a question, or needs domain context to interpret tool results, it searches the workspace's knowledge index.

## How it works

1. **Ingest** -- SupaProxy fetches content from the configured sources (wiki pages, files, URLs)
2. **Chunk** -- content is split into segments (~500 tokens each) with overlap for context preservation
3. **Index** -- chunks are embedded and stored in a vector index for semantic search
4. **Search** -- when the AI needs context, SupaProxy searches for the most relevant chunks and injects them into the prompt
5. **Sync** -- sources are re-fetched periodically to stay current. Wiki pages check for version changes. Files watch for modification timestamps.

## Source types

### Wiki / Confluence

Connect a wiki space or specific pages. SupaProxy fetches via the wiki's REST API, converts from storage format to text, and indexes.

```yaml
knowledge:
  sources:
    - type: confluence
      space: ENG
      pages:
        - "1. Service Overview"
        - "3. Key Flows"
        - "4. Service Dependencies"
```

Sync: checks page version number every hour. Re-indexes only if content changed.

### Files

Markdown, text, or PDF files. Upload via the dashboard or reference by path.

```yaml
    - type: file
      paths:
        - onboarding-guide.md
        - process-flows.md
        - team-conventions.md
```

Sync: checks file modification timestamp. Re-indexes on change.

### URLs (planned)

Fetch and index a web page. Useful for public documentation, API docs, or internal wiki pages outside your primary wiki.

```yaml
    - type: url
      urls:
        - https://docs.example.com/api
        - https://wiki.example.com/runbooks/payment-flow
```

### Inline

Raw text embedded in the workspace config. Good for small, stable context like business rules or team-specific conventions.

```yaml
    - type: inline
      content: |
        Region differences:
        - EMEA: bank transfer payments, recurring references
        - APAC: card payments, one-time references
```

Always available -- no sync needed. Injected directly into the system prompt.

## Knowledge vs tools

|  | Tools (connections) | Knowledge (indexed docs) |
|---|---|---|
| Data type | Live, structured (JSON) | Static, unstructured (text) |
| Freshness | Real-time (queries live data) | Periodically synced |
| Use case | "What's the status of order X?" | "How does the payment flow work?" |
| Cost | Tool call + backend query | Vector search + prompt injection |

The AI decides when to use tools vs knowledge. If it has a matching tool, it calls it. If it needs context to interpret the result or answer a conceptual question, it searches knowledge.

## Per-workspace isolation

Each workspace has its own vector index. One team's wiki pages are not searchable from another team's workspace. Knowledge never leaks across workspace boundaries.

## Chunk metrics

The dashboard shows per-source chunk counts. This tells you how much content is indexed:

- A typical wiki page produces 5-20 chunks
- A large reference doc produces ~50 chunks
- Inline text produces 1-4 chunks

More chunks = more context available, but also more vector search overhead per query. Keep sources relevant -- don't index everything, index what the AI actually needs.
