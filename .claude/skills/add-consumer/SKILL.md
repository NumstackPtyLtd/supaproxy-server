---
name: add-consumer
description: >
  Adds a new consumer type to SupaProxy following DDD architecture. Consumers
  connect external message sources to the agent loop via the container's use
  cases. No direct DB access or core module imports.
---

# Add Consumer (DDD)

A consumer connects an external message source (Slack, WhatsApp, Discord) to the SupaProxy agent loop. The Slack consumer (`infrastructure/consumers/SlackConsumer.ts`) is the reference implementation.

## Step 1: Create the consumer file

Create `src/infrastructure/consumers/{Name}Consumer.ts`.

The consumer receives the container as a dependency and uses use cases for all operations:

```typescript
import pino from 'pino'
import type { Container } from '../../container.js'

const log = pino({ name: '<name>-consumer' })

let activeClient: ClientType | null = null

async function handleQuery(
  query: string,
  workspaceId: string,
  meta: { channel: string; userId: string; userName: string; sessionId: string },
  container: Container,
) {
  const result = await container.executeQueryUseCase.execute(workspaceId, query, {
    consumerType: '<name>',
    channel: meta.channel,
    userId: meta.userId,
    userName: meta.userName,
    sessionId: meta.sessionId,
  })
  return result.answer
}

export async function start{Name}Consumer(token: string, container: Container) {
  // 1. Initialise the external client
  // 2. Register message handlers that call handleQuery
  // 3. Register with container.posterRegistry for lifecycle messages
  container.posterRegistry.register('<name>', async (target, text) => {
    // Post lifecycle messages (cold, close) back to the external service
  })

  log.info('<Name> consumer started')
}

export async function stop{Name}Consumer() {
  if (activeClient) {
    activeClient = null
  }
}
```

## Step 2: Key DDD rules

1. **Use container for all operations.** Never call `getPool()` or import from `domain/` directly.
2. **Use `container.executeQueryUseCase`** for running queries through the agent loop.
3. **Use `container.workspaceRepo`** for workspace lookups (e.g. finding workspace by channel).
4. **Use `container.conversationRepo`** for conversation thread tracking.
5. **Register with `container.posterRegistry`** so the lifecycle loop can send cold/close messages.
6. **No business logic.** The consumer maps external events to use case calls.

## Step 3: Add consumer type handler

If the consumer needs to be connected via the dashboard, add a handler to `container.ts`:

```typescript
const consumerTypeHandlers = {
  '<name>': {
    buildConfig(credentials: Record<string, string>, channelId?: string) {
      return JSON.stringify({ token: credentials.token, channels: channelId ? [channelId] : [] })
    },
    async verifyCredentials(credentials: Record<string, string>) {
      // Validate credentials with external API
    },
    async start(credentials: Record<string, string>) {
      const { start{Name}Consumer } = await import('./infrastructure/consumers/{Name}Consumer.js')
      await start{Name}Consumer(credentials.token, container)
    },
  },
}
```

## Step 4: Wire up in index.ts

```typescript
try {
  const token = await container.orgRepo.getSettingValue('<name>_token')
  if (token) {
    const { start{Name}Consumer } = await import('./infrastructure/consumers/{Name}Consumer.js')
    await start{Name}Consumer(token, container)
  } else {
    log.info('<Name> consumer not configured')
  }
} catch (err) {
  log.warn({ error: (err as Error).message }, '<Name> consumer failed - server continues')
}
```

## Step 5: Rules

- **Container injection, not direct imports.** The consumer receives the container, not individual services.
- **No `getPool()` calls.** All DB access through container repositories.
- **No `import ... from '../core/'`.** The old core layer does not exist.
- **Consumer failure is non-fatal.** The server continues if a consumer fails to start.
- **Log with pino.** Not `console.log`.
- **No provider names in logs.**
- **No hardcoded tokens.** Read from `org_settings` via `container.orgRepo.getSettingValue()`.
