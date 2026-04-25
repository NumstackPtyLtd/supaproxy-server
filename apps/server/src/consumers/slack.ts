import { App } from '@slack/bolt';
import pino from 'pino';
import { getPool } from '../db/pool.js';
import { runAgent } from '../core/agent.js';
import { findOrCreateConversation, getConversationHistory } from '../core/conversation.js';
import type { ConnectionRow, ConversationRow, WorkspaceRow } from '../db/types.js';
import type { RowDataPacket } from 'mysql2';

const log = pino({ name: 'slack-consumer' });

/** Slack WebClient type derived from App instance */
type SlackClient = App['client'];

/** Joined result from consumers + workspaces for channel lookup */
interface WorkspaceConsumerRow extends RowDataPacket {
  workspace_id: string;
  config: string;
  model: string;
  system_prompt: string | null;
  max_tool_rounds: number;
}

/** Subset of WorkspaceRow for DM lookup */
interface WorkspaceDmRow extends RowDataPacket {
  id: string;
  model: string;
  system_prompt: string | null;
  max_tool_rounds: number;
}

/** Connection row subset needed for MCP server config */
interface ConnectionConfigRow extends RowDataPacket {
  name: string;
  type: string;
  config: string;
}

/** Slack say() function signature */
type SayFn = (message: { text: string; thread_ts: string }) => Promise<unknown>;

/** Fields used from Slack message events (subset of GenericMessageEvent) */
interface SlackMessageEvent {
  bot_id?: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  channel: string;
  channel_type?: string;
}

let botUserId: string | null = null;

function stripMention(text: string): string {
  return text.replace(/<@[A-Z0-9]+>\s*/g, '').trim();
}

async function getWorkspaceForChannel(channelId: string) {
  const db = getPool();
  const [rows] = await db.execute<WorkspaceConsumerRow[]>(
    'SELECT c.workspace_id, c.config, w.model, w.system_prompt, w.max_tool_rounds FROM consumers c JOIN workspaces w ON c.workspace_id = w.id WHERE c.type = "slack" AND w.status = "active"'
  );

  for (const row of rows) {
    const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
    const channels = cfg.channels || [];
    if (channels.includes(channelId)) {
      return row;
    }
  }
  return null;
}

async function getConnections(workspaceId: string) {
  const db = getPool();
  const [rows] = await db.execute<ConnectionConfigRow[]>(
    'SELECT name, type, config FROM connections WHERE workspace_id = ?',
    [workspaceId]
  );
  return rows;
}

// Cache Slack user ID -> display name
const userNameCache = new Map<string, string>();

async function resolveUserName(userId: string, client: SlackClient): Promise<string> {
  if (userNameCache.has(userId)) return userNameCache.get(userId)!;
  try {
    const info = await client.users.info({ user: userId });
    const name = info.user?.real_name || info.user?.name || userId;
    userNameCache.set(userId, name);
    return name;
  } catch {
    return userId;
  }
}

async function handleQuery(query: string, channel: string, threadTs: string, eventTs: string, userName: string, userId: string, client: SlackClient, say: SayFn) {
  if (!query) {
    say({ text: 'Ask a question.', thread_ts: threadTs });
    return;
  }

  // Resolve display name from Slack
  const displayName = await resolveUserName(userId, client);

  const ws = await getWorkspaceForChannel(channel);
  if (!ws) {
    log.warn({ channel }, 'No workspace found for channel');
    return;
  }

  // Typing indicator
  try { await client.reactions.add({ channel, timestamp: eventTs, name: 'hourglass_flowing_sand' }); } catch (err) { log.debug({ error: (err as Error).message }, 'Reaction failed'); }

  // Find or create conversation (DB-backed)
  const externalThreadId = `${channel}:${threadTs}`;
  const conversationId = await findOrCreateConversation(
    ws.workspace_id, 'slack', externalThreadId, displayName, channel
  );

  // Load history from DB
  const history = await getConversationHistory(conversationId);

  // Get connections
  const connections = await getConnections(ws.workspace_id);

  // Run agent
  const result = await runAgent(query, {
    workspaceId: ws.workspace_id,
    model: ws.model,
    systemPrompt: ws.system_prompt || 'You are a helpful assistant.',
    maxToolRounds: ws.max_tool_rounds || 10,
    mcpServers: connections,
  }, history, {
    consumerType: 'slack',
    channel,
    userId,
    userName: displayName,
    conversationId,
  });

  // Remove hourglass, add checkmark
  try { await client.reactions.remove({ channel, timestamp: eventTs, name: 'hourglass_flowing_sand' }); } catch (err) { log.debug({ error: (err as Error).message }, 'Reaction failed'); }
  try { await client.reactions.add({ channel, timestamp: eventTs, name: 'white_check_mark' }); } catch (err) { log.debug({ error: (err as Error).message }, 'Reaction failed'); }

  try {
    const postResult = await say({ text: result.answer, thread_ts: threadTs });
    log.info({ channel, threadTs, ok: true }, 'Reply posted');
  } catch (err) {
    log.error({ error: (err as Error).message, channel, threadTs }, 'say() failed — falling back to chat.postMessage');
    try {
      await client.chat.postMessage({ channel, thread_ts: threadTs, text: result.answer });
      log.info({ channel, threadTs }, 'Fallback reply posted');
    } catch (err2) {
      log.error({ error: (err2 as Error).message, channel, threadTs }, 'Fallback also failed');
    }
  }
}

// Active Slack app instance
let activeApp: App | null = null;

export async function stopSlackConsumer() {
  if (activeApp) {
    try {
      await activeApp.stop();
      activeApp = null;
      log.info('Slack consumer stopped');
    } catch (err) {
      log.debug({ error: (err as Error).message }, 'Slack consumer stop failed');
    }
  }
}

/**
 * Post a message to a Slack thread. Used by the lifecycle loop for cold messages.
 */
export async function postToThread(channel: string, threadTs: string, text: string) {
  if (!activeApp) throw new Error('Slack consumer not running');
  await activeApp.client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text,
  });
}

export async function startSlackConsumer(botToken?: string, appToken?: string) {
  botToken = botToken || process.env.SLACK_BOT_TOKEN;
  appToken = appToken || process.env.SLACK_APP_TOKEN;

  if (!botToken || !appToken) {
    log.warn('No Slack tokens available - consumer disabled');
    return;
  }

  await stopSlackConsumer();

  let app: App;
  try {
    app = new App({ token: botToken, appToken, socketMode: true });
    const auth = await app.client.auth.test({ token: botToken });
    botUserId = auth.user_id as string;
    log.info({ botUserId }, 'Bot user resolved');
  } catch (err) {
    log.error({ error: (err as Error).message }, 'Slack auth failed');
    throw err;
  }

  // Handle @mentions
  app.event('app_mention', async ({ event, say, client }) => {
    const threadTs = event.thread_ts || event.ts;
    const query = stripMention(event.text || '');
    log.info({ eventTs: event.ts, threadTs, channel: event.channel, text: query?.slice(0, 50) }, 'app_mention received');
    handleQuery(query, event.channel, threadTs, event.ts, event.user || '', event.user || '', client, say as SayFn);
  });

  // Handle thread replies (no @mention needed if bot is in the thread)
  app.event('message', async ({ event, say, client }) => {
    const msg = event as SlackMessageEvent;
    if (msg.bot_id || msg.user === botUserId) return;
    const threadTs = msg.thread_ts;
    if (!threadTs) return;

    // Check if we have a conversation for this thread
    const externalThreadId = `${msg.channel}:${threadTs}`;
    const db = getPool();
    const [rows] = await db.execute<ConversationRow[]>(
      `SELECT id FROM conversations WHERE external_thread_id = ? AND status IN ('open', 'cold') LIMIT 1`,
      [externalThreadId]
    );
    if (!rows[0]) return; // Not our thread

    const query = stripMention(msg.text || '');
    handleQuery(query, msg.channel, threadTs, msg.ts, msg.user || '', msg.user || '', client, say as SayFn);
  });

  // Handle DMs
  app.event('message', async ({ event, say, client }) => {
    const msg = event as SlackMessageEvent;
    if (msg.channel_type !== 'im') return;
    if (msg.bot_id || msg.user === botUserId) return;

    const threadTs = msg.thread_ts || msg.ts;
    const query = (msg.text || '').trim();

    const db = getPool();
    const [wsRows] = await db.execute<WorkspaceDmRow[]>('SELECT id, model, system_prompt, max_tool_rounds FROM workspaces WHERE status = "active" LIMIT 1');
    if (!wsRows[0]) {
      (say as SayFn)({ text: 'No workspaces configured.', thread_ts: threadTs });
      return;
    }

    const ws = wsRows[0];
    const externalThreadId = `dm:${msg.channel}:${threadTs}`;
    const conversationId = await findOrCreateConversation(ws.id, 'slack', externalThreadId, msg.user, msg.channel);
    const history = await getConversationHistory(conversationId);
    const connections = await getConnections(ws.id);

    const result = await runAgent(query, {
      workspaceId: ws.id,
      model: ws.model,
      systemPrompt: ws.system_prompt || 'You are a helpful assistant.',
      maxToolRounds: ws.max_tool_rounds || 10,
      mcpServers: connections,
    }, history, {
      consumerType: 'slack',
      channel: msg.channel,
      userId: msg.user,
      userName: msg.user,
      conversationId,
    });

    (say as SayFn)({ text: result.answer, thread_ts: threadTs });
  });

  try {
    await app.start();
    activeApp = app;

    // Register as a consumer poster for lifecycle messages (cold, close, etc.)
    const { registerConsumerPoster } = await import('../core/lifecycle.js');
    registerConsumerPoster('slack', async (conversation, text) => {
      const threadTs = conversation.externalThreadId?.split(':')[1];
      if (conversation.channel && threadTs) {
        await postToThread(conversation.channel, threadTs, text);
      }
    });

    log.info('Slack consumer started (Socket Mode)');
  } catch (err) {
    log.error({ error: (err as Error).message }, 'Slack consumer failed to start');
    throw err;
  }
}
