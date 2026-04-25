---
name: add-consumer
description: >
  Adds a new consumer type to SupaProxy. Consumers connect external message
  sources (Slack, WhatsApp, Discord, webhooks) to the agent loop. Covers
  file placement, interface patterns, workspace binding, and server boot
  integration.
---

# Add Consumer

A consumer connects an external message source to the SupaProxy agent loop. The existing Slack consumer (`apps/server/src/consumers/slack.ts`) is the reference implementation.

## Step 1: Create the consumer file

Create `apps/server/src/consumers/<name>.ts`.

Follow this structure:

```typescript
import pino from 'pino';
import { getPool } from '../db/pool.js';
import { runAgent } from '../core/agent.ts';
import { findOrCreateConversation, getConversationHistory } from '../core/conversation.js';
import type { RowDataPacket } from 'mysql2';

const log = pino({ name: '<name>-consumer' });

// Define typed row interfaces for DB queries
interface WorkspaceConsumerRow extends RowDataPacket {
  workspace_id: string;
  config: string;
  model: string;
  system_prompt: string | null;
  max_tool_rounds: number;
}

// Workspace lookup: map the external channel/endpoint to a SupaProxy workspace
async function getWorkspaceForChannel(channelId: string) {
  const db = getPool();
  const [rows] = await db.execute<WorkspaceConsumerRow[]>(
    `SELECT c.workspace_id, c.config, w.model, w.system_prompt, w.max_tool_rounds
     FROM consumers c
     JOIN workspaces w ON c.workspace_id = w.id
     WHERE c.type = ? AND w.status = 'active'`,
    ['<name>']
  );
  // Parse config JSON and match channelId to workspace
  // Return the matching workspace or null
}

// Message handler: receive message, run agent, post response
async function handleMessage(channelId: string, userId: string, text: string) {
  const workspace = await getWorkspaceForChannel(channelId);
  if (!workspace) {
    log.warn({ channelId }, 'No workspace found for channel');
    return;
  }

  // Find or create a conversation for this channel/thread
  const conversation = await findOrCreateConversation(
    workspace.workspace_id,
    channelId,  // external_id
    '<name>'    // source type
  );

  // Get conversation history for context
  const history = await getConversationHistory(conversation.id);

  // Run the agent
  const result = await runAgent({
    query: text,
    workspaceId: workspace.workspace_id,
    conversationId: conversation.id,
    model: workspace.model,
    systemPrompt: workspace.system_prompt,
    maxToolRounds: workspace.max_tool_rounds,
    history,
  });

  // Post the response back through the external service
  // ... consumer-specific response logic
}

// Export the start function (called from index.ts at boot)
export async function startConsumer(/* tokens/config */) {
  // Initialize the external client/connection
  // Register event handlers that call handleMessage
  // Log successful startup
  log.info('<Name> consumer started');
}
```

## Step 2: Key patterns from the Slack reference

The Slack consumer (`consumers/slack.ts`) demonstrates:

1. **Typed DB rows** -- every `pool.execute<T>()` uses an interface extending `RowDataPacket`
2. **Workspace lookup** -- maps Slack channel ID to a workspace via the `consumers` table
3. **Conversation tracking** -- uses `findOrCreateConversation()` to maintain context
4. **Agent integration** -- calls `runAgent()` from `core/agent.ts`
5. **Error handling** -- wraps message handling in try/catch, logs errors with pino
6. **Bot self-detection** -- ignores messages from the bot itself to prevent loops

## Step 3: Register in the database

The consumer needs a row in the `consumers` table:

```sql
INSERT INTO consumers (id, type, workspace_id, config, status)
VALUES (UUID(), '<name>', '<workspace_id>', '{"channel_id": "..."}', 'active');
```

The `config` column stores consumer-specific JSON (channel IDs, webhook URLs, etc.).

## Step 4: Wire up in index.ts

Add the consumer startup to `index.ts` inside the `serve()` callback, following the Slack pattern:

```typescript
// Start <name> consumer
try {
  const [tokenRows] = await pool.execute<ValueRow[]>(
    "SELECT value FROM org_settings WHERE key_name = '<name>_token' LIMIT 1"
  )
  const token = tokenRows[0]?.value
  if (token) {
    const { startConsumer } = await import('./consumers/<name>.js')
    await startConsumer(token)
  } else {
    log.info('<Name> consumer not configured - set token in org settings')
  }
} catch (err) {
  log.warn({ error: (err as Error).message }, '<Name> consumer failed - server continues without it')
}
```

Key rules:
- **Dynamic import** -- use `await import()` so the consumer module is only loaded if configured
- **Graceful failure** -- consumer startup failure must NOT crash the server
- **Log clearly** -- log whether the consumer started, was not configured, or failed

## Step 5: Rules

- **No hardcoded tokens** -- read from `org_settings` table or environment via `requireEnv()`
- **No provider names in logs** -- say "AI provider", not brand names
- **Type all DB rows** -- no `as any` on query results
- **Log with pino** -- not `console.log`
- **Consumers start at boot only** -- document that token changes require a server restart
- **Consumer failure is non-fatal** -- the server must continue running if a consumer fails to start

## Step 6: Restart and verify

Run `/restart-servers` and check logs:

```bash
strings /tmp/supaproxy-server.log | grep -i "<name>\|consumer\|started\|failed"
```
