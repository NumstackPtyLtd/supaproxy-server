import { Queue, Worker } from 'bullmq';
import pino from 'pino';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages.js';
import { transitionColdConversations, transitionClosedConversations, generateConversationStats } from './conversation.js';

import { REDIS_HOST, REDIS_PORT } from '../config.js';
import { getDefaultModel } from '../db/pool.js';
import type { ValueRow } from '../db/types.js';

const log = pino({ name: 'lifecycle' });

const connection = { host: REDIS_HOST, port: REDIS_PORT };

// Consumer message handlers — each consumer type registers itself
interface ColdMessageJob {
  conversationId: string
  consumerType: string
  channel: string
  externalThreadId: string
}

const consumerPosters = new Map<string, (conversation: ColdMessageJob, text: string) => Promise<void>>();

export function registerConsumerPoster(
  consumerType: string,
  poster: (conversation: ColdMessageJob, text: string) => Promise<void>
) {
  consumerPosters.set(consumerType, poster);
  log.info({ consumerType }, 'Consumer poster registered');
}

// --- Queues ---

export const lifecycleQueue = new Queue('lifecycle', { connection });
export const coldMessageQueue = new Queue('cold-messages', { connection });
export const statsQueue = new Queue('conversation-stats', { connection });
export const allQueues = { lifecycle: lifecycleQueue, 'cold-messages': coldMessageQueue, 'conversation-stats': statsQueue };

// --- Workers ---

let lifecycleWorker: Worker | null = null;
let coldMessageWorker: Worker | null = null;
let statsWorker: Worker | null = null;

async function generateColdMessage(conversationId: string): Promise<string> {
  try {
    const { getConversationHistory } = await import('./conversation.js');
    const messages = await getConversationHistory(conversationId);
    if (messages.length === 0) return '';

    const { getPool } = await import('../db/pool.js');
    const db = getPool();
    const [keyRows] = await db.execute<ValueRow[]>(
      "SELECT value FROM org_settings WHERE key_name = 'anthropic_api_key' LIMIT 1"
    );
    if (!keyRows[0]?.value) return '';

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: keyRows[0].value });

    const transcript = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n\n');

    const model = await getDefaultModel();
    const response = await anthropic.messages.create({
      model,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `You are a support assistant. This conversation has gone quiet. Based on the conversation below, write a brief, natural follow-up message (1-2 sentences) checking in with the user. Be warm but not pushy. If it looks like the issue was resolved, acknowledge that. If not, offer to continue helping. Do not use generic corporate language. Just reply with the message text, nothing else.

${transcript}`
      }],
    });

    return response.content.filter((b): b is TextBlock => b.type === 'text').map((b) => b.text).join('') || '';
  } catch (err) {
    log.warn({ conversationId, error: (err as Error).message }, 'Could not generate cold message');
    return '';
  }
}

export async function startLifecycleLoop() {
  // Lifecycle scanner — runs on a repeating schedule, finds conversations to transition
  lifecycleWorker = new Worker('lifecycle', async () => {
    try {
      // Cold transitions
      const coldConvos = await transitionColdConversations();
      for (const c of coldConvos) {
        // Queue a cold message job for each
        await coldMessageQueue.add('send-cold-message', {
          conversationId: c.id,
          consumerType: c.consumer_type,
          channel: c.channel,
          externalThreadId: c.external_thread_id,
        });
      }

      // Close transitions
      const closedIds = await transitionClosedConversations();
      for (const id of closedIds) {
        // Queue a stats generation job for each
        await statsQueue.add('generate-stats', { conversationId: id });
      }
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Lifecycle scan failed');
    }
  }, { connection });

  // Cold message worker — sends follow-up messages via the right consumer
  coldMessageWorker = new Worker('cold-messages', async (job) => {
    const { conversationId, consumerType } = job.data;
    const poster = consumerPosters.get(consumerType);
    if (!poster) {
      log.warn({ consumerType, conversationId }, 'No poster registered for consumer type');
      return;
    }

    const message = await generateColdMessage(conversationId)
      || "Just checking in — do you still need help with this? If not, we will close this conversation shortly.";

    await poster(job.data, message);
    log.info({ conversationId, consumerType }, 'Cold message sent');
  }, {
    connection,
    concurrency: 3,
  });

  // Stats worker — generates AI analysis for closed conversations
  statsWorker = new Worker('conversation-stats', async (job) => {
    const { conversationId } = job.data;
    await generateConversationStats(conversationId);
  }, {
    connection,
    concurrency: 2,
  });

  // Error handlers
  lifecycleWorker.on('failed', (job, err) => log.error({ job: job?.id, error: err.message }, 'Lifecycle job failed'));
  coldMessageWorker.on('failed', (job, err) => log.error({ job: job?.id, error: err.message }, 'Cold message job failed'));
  statsWorker.on('failed', (job, err) => log.error({ job: job?.id, error: err.message }, 'Stats job failed'));

  // Schedule the lifecycle scan to repeat every 30 seconds
  await lifecycleQueue.upsertJobScheduler(
    'scan',
    { every: 30_000 },
    { name: 'lifecycle-scan' }
  );

  log.info('Lifecycle started (BullMQ — scan every 30s, 3 cold message workers, 2 stats workers)');
}

export async function stopLifecycleLoop() {
  await lifecycleWorker?.close();
  await coldMessageWorker?.close();
  await statsWorker?.close();
  lifecycleWorker = null;
  coldMessageWorker = null;
  statsWorker = null;
}
