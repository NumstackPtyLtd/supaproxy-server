import { App } from '@slack/bolt'
import pino from 'pino'
import type { Container } from '../../container.js'
import type { RowDataPacket } from 'mysql2'

const log = pino({ name: 'slack-consumer' })

type SlackClient = App['client']
type SayFn = (message: { text: string; thread_ts: string }) => Promise<unknown>

interface SlackMessageEvent {
  bot_id?: string
  user?: string
  text?: string
  ts: string
  thread_ts?: string
  channel: string
  channel_type?: string
}

let botUserId: string | null = null
let activeApp: App | null = null
const userNameCache = new Map<string, string>()

function stripMention(text: string): string {
  return text.replace(/<@[A-Z0-9]+>\s*/g, '').trim()
}

async function resolveUserName(userId: string, client: SlackClient): Promise<string> {
  if (userNameCache.has(userId)) return userNameCache.get(userId)!
  try {
    const info = await client.users.info({ user: userId })
    const name = info.user?.real_name || info.user?.name || userId
    userNameCache.set(userId, name)
    return name
  } catch {
    return userId
  }
}

async function handleQuery(
  query: string, channel: string, threadTs: string, eventTs: string,
  userName: string, userId: string, client: SlackClient, say: SayFn,
  container: Container,
) {
  if (!query) {
    say({ text: 'Ask a question.', thread_ts: threadTs })
    return
  }

  const displayName = await resolveUserName(userId, client)
  const consumers = await container.workspaceRepo.findActiveSlackConsumers()

  let ws: typeof consumers[0] | null = null
  for (const row of consumers) {
    const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config
    if ((cfg.channels || []).includes(channel)) { ws = row; break }
  }
  if (!ws) { log.warn({ channel }, 'No workspace found for channel'); return }

  try { await client.reactions.add({ channel, timestamp: eventTs, name: 'hourglass_flowing_sand' }) } catch { /* ignore */ }

  try {
    const result = await container.executeQueryUseCase.execute(ws.workspace_id, query, {
      consumerType: 'slack',
      channel,
      userId,
      userName: displayName,
      sessionId: `${channel}:${threadTs}`,
    })

    try { await client.reactions.remove({ channel, timestamp: eventTs, name: 'hourglass_flowing_sand' }) } catch { /* ignore */ }
    try { await client.reactions.add({ channel, timestamp: eventTs, name: 'white_check_mark' }) } catch { /* ignore */ }

    try {
      await say({ text: result.answer, thread_ts: threadTs })
    } catch {
      try { await client.chat.postMessage({ channel, thread_ts: threadTs, text: result.answer }) } catch (err2) {
        log.error({ error: (err2 as Error).message }, 'Fallback reply failed')
      }
    }
  } catch (err) {
    log.error({ error: (err as Error).message }, 'Query failed')
    try { await client.reactions.remove({ channel, timestamp: eventTs, name: 'hourglass_flowing_sand' }) } catch { /* ignore */ }
  }
}

export async function postToThread(channel: string, threadTs: string, text: string) {
  if (!activeApp) throw new Error('Slack consumer not running')
  await activeApp.client.chat.postMessage({ channel, thread_ts: threadTs, text })
}

export async function stopSlackConsumer() {
  if (activeApp) {
    try { await activeApp.stop(); activeApp = null } catch { /* ignore */ }
  }
}

export async function startSlackConsumer(botToken: string, appToken: string, container: Container) {
  if (!botToken || !appToken) { log.warn('No Slack tokens - consumer disabled'); return }

  await stopSlackConsumer()

  const app = new App({ token: botToken, appToken, socketMode: true })
  const auth = await app.client.auth.test({ token: botToken })
  botUserId = auth.user_id as string
  log.info({ botUserId }, 'Bot user resolved')

  app.event('app_mention', async ({ event, say, client }) => {
    const threadTs = event.thread_ts || event.ts
    const query = stripMention(event.text || '')
    handleQuery(query, event.channel, threadTs, event.ts, event.user || '', event.user || '', client, say as SayFn, container)
  })

  app.event('message', async ({ event, say, client }) => {
    const msg = event as SlackMessageEvent
    if (msg.bot_id || msg.user === botUserId) return

    // Thread replies
    if (msg.thread_ts) {
      const externalThreadId = `${msg.channel}:${msg.thread_ts}`
      const existing = await container.conversationRepo.findByExternalThreadId(externalThreadId, ['open', 'cold'])
      if (!existing) return
      const query = stripMention(msg.text || '')
      handleQuery(query, msg.channel, msg.thread_ts, msg.ts, msg.user || '', msg.user || '', client, say as SayFn, container)
      return
    }

    // DMs
    if (msg.channel_type === 'im') {
      const threadTs = msg.ts
      const query = (msg.text || '').trim()
      const ws = await container.workspaceRepo.getFirstActiveWorkspace()
      if (!ws) { (say as SayFn)({ text: 'No workspaces configured.', thread_ts: threadTs }); return }

      const result = await container.executeQueryUseCase.execute(ws.id, query, {
        consumerType: 'slack',
        channel: msg.channel,
        userId: msg.user,
        userName: msg.user,
        sessionId: `dm:${msg.channel}:${threadTs}`,
      })
      ;(say as SayFn)({ text: result.answer, thread_ts: threadTs })
    }
  })

  await app.start()
  activeApp = app

  container.posterRegistry.register('slack', async (target, text) => {
    const threadTs = target.externalThreadId?.split(':')[1]
    if (target.channel && threadTs) {
      await postToThread(target.channel, threadTs, text)
    }
  })

  log.info('Slack consumer started (Socket Mode)')
}
