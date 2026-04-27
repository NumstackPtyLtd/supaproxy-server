import pino from 'pino';
import { randomBytes } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages.js';
import { getPool, getDefaultModel } from '../db/pool.js';
import type { ConversationRow, ConversationStatsRow, IdRow, ValueRow } from '../db/types.js';

const log = pino({ name: 'conversation' });

// ── Inline row types for custom query shapes ──

interface NextSeqRow extends RowDataPacket { next_seq: number }
interface RoleContentRow extends RowDataPacket { role: string; content: string }
interface ColdTransitionRow extends RowDataPacket { id: string; channel: string; external_thread_id: string; consumer_type: string }
interface AggRow extends RowDataPacket { ti: number; to2: number; cost: number; dur: number; qcount: number }
interface ConvTimestampRow extends RowDataPacket { first_message_at: string | null; closed_at: string | null; message_count: number }
interface ModelRow extends RowDataPacket { model: string }

/**
 * Find an open/cold conversation for this thread, or create a new one.
 * If the last conversation on this thread is closed, create a new one with parent link.
 */
export async function findOrCreateConversation(
  workspaceId: string,
  consumerType: string,
  externalThreadId: string,
  userName?: string,
  channel?: string,
): Promise<string> {
  const db = getPool();

  // Look for existing open or cold conversation
  const [rows] = await db.execute<ConversationRow[]>(
    `SELECT id, status FROM conversations
     WHERE workspace_id = ? AND consumer_type = ? AND external_thread_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [workspaceId, consumerType, externalThreadId]
  );

  if (rows[0]) {
    if (rows[0].status === 'open' || rows[0].status === 'cold') {
      // Re-open if cold
      if (rows[0].status === 'cold') {
        await db.execute(
          "UPDATE conversations SET status = 'open', cold_at = NULL, updated_at = NOW() WHERE id = ?",
          [rows[0].id]
        );
        log.info({ id: rows[0].id }, 'Conversation re-opened from cold');
      }
      return rows[0].id;
    }

    // Closed — create a new one linked to parent
    const newId = randomBytes(16).toString('hex');
    await db.execute(
      `INSERT INTO conversations (id, workspace_id, consumer_type, external_thread_id, status, user_name, channel, first_message_at, last_activity_at, parent_conversation_id)
       VALUES (?, ?, ?, ?, 'open', ?, ?, NOW(), NOW(), ?)`,
      [newId, workspaceId, consumerType, externalThreadId, userName || null, channel || null, rows[0].id]
    );
    log.info({ id: newId, parent: rows[0].id }, 'New conversation (follow-up to closed)');
    return newId;
  }

  // No existing conversation — create fresh
  const newId = randomBytes(16).toString('hex');
  await db.execute(
    `INSERT INTO conversations (id, workspace_id, consumer_type, external_thread_id, status, user_name, channel, first_message_at, last_activity_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?, NOW(), NOW())`,
    [newId, workspaceId, consumerType, externalThreadId, userName || null, channel || null]
  );
  log.info({ id: newId, thread: externalThreadId }, 'New conversation');
  return newId;
}

/**
 * Record a message in a conversation.
 */
export async function recordMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  auditLogId?: string,
) {
  const db = getPool();
  const msgId = randomBytes(16).toString('hex');

  // Get next sequence number for this conversation
  const [seqRows] = await db.execute<NextSeqRow[]>(
    'SELECT COALESCE(MAX(seq), 0) + 1 as next_seq FROM conversation_messages WHERE conversation_id = ?',
    [conversationId]
  );
  const seq = seqRows[0]?.next_seq || 1;

  await db.execute(
    `INSERT INTO conversation_messages (id, conversation_id, role, content, audit_log_id, seq)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [msgId, conversationId, role, content, auditLogId || null, seq]
  );

  await db.execute(
    `UPDATE conversations SET message_count = message_count + 1, last_activity_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [conversationId]
  );
}

/**
 * Load conversation history for the agent (replaces in-memory Map).
 */
export async function getConversationHistory(conversationId: string): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const db = getPool();
  const [rows] = await db.execute<RoleContentRow[]>(
    `SELECT role, content FROM conversation_messages WHERE conversation_id = ? ORDER BY seq ASC`,
    [conversationId]
  );
  return rows.map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

/**
 * Transition open conversations to cold after workspace timeout.
 * Returns the conversations that were transitioned (for Slack messaging).
 */
export async function transitionColdConversations(): Promise<Array<{ id: string; channel: string; external_thread_id: string; consumer_type: string }>> {
  const db = getPool();
  const [rows] = await db.execute<ColdTransitionRow[]>(
    `SELECT c.id, c.channel, c.external_thread_id, c.consumer_type
     FROM conversations c
     JOIN workspaces w ON c.workspace_id = w.id
     WHERE c.status = 'open'
       AND c.last_activity_at < NOW() - INTERVAL w.cold_timeout_minutes MINUTE`
  );

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  await db.execute(
    `UPDATE conversations SET status = 'cold', cold_at = NOW(), updated_at = NOW()
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );

  log.info({ count: rows.length }, 'Conversations transitioned to cold');
  return rows;
}

/**
 * Transition cold conversations to closed after workspace timeout.
 * Returns conversation IDs for stats generation.
 */
export async function transitionClosedConversations(): Promise<string[]> {
  const db = getPool();
  const [rows] = await db.execute<IdRow[]>(
    `SELECT c.id
     FROM conversations c
     JOIN workspaces w ON c.workspace_id = w.id
     WHERE c.status = 'cold'
       AND c.cold_at < NOW() - INTERVAL w.close_timeout_minutes MINUTE`
  );

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  await db.execute(
    `UPDATE conversations SET status = 'closed', closed_at = NOW(), updated_at = NOW()
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );

  log.info({ count: ids.length }, 'Conversations closed');
  return ids;
}

/**
 * Generate stats for a closed conversation using AI analysis.
 */
export async function generateConversationStats(conversationId: string) {
  const db = getPool();

  // Check if stats already exist and are complete
  const [existing] = await db.execute<ConversationStatsRow[]>(
    "SELECT id, stats_status FROM conversation_stats WHERE conversation_id = ?", [conversationId]
  );

  let statsId: string;
  if (existing[0]) {
    if (existing[0].stats_status === 'complete') return; // Already done
    statsId = existing[0].id;
  } else {
    statsId = randomBytes(16).toString('hex');
    await db.execute(
      `INSERT INTO conversation_stats (id, conversation_id, stats_status) VALUES (?, ?, 'pending')`,
      [statsId, conversationId]
    );
  }

  try {
    // Load messages
    const messages = await getConversationHistory(conversationId);
    if (messages.length === 0) {
      await db.execute("UPDATE conversation_stats SET stats_status = 'failed' WHERE id = ?", [statsId]);
      return;
    }

    // Load aggregate data from audit_logs
    const [agg] = await db.execute<AggRow[]>(
      `SELECT COALESCE(SUM(tokens_input), 0) as ti, COALESCE(SUM(tokens_output), 0) as to2,
              COALESCE(SUM(cost_usd), 0) as cost, COALESCE(SUM(duration_ms), 0) as dur,
              COUNT(*) as qcount
       FROM audit_logs WHERE conversation_id = ?`,
      [conversationId]
    );

    // Load conversation timestamps
    const [conv] = await db.execute<ConvTimestampRow[]>(
      "SELECT first_message_at, closed_at, message_count FROM conversations WHERE id = ?",
      [conversationId]
    );

    const durationSec = conv[0] && conv[0].first_message_at && conv[0].closed_at
      ? Math.round((new Date(conv[0].closed_at).getTime() - new Date(conv[0].first_message_at).getTime()) / 1000)
      : 0;

    // Build transcript
    const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');

    // AI analysis
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    let apiKey: string | undefined;
    try {
      const [keyRows] = await db.execute<ValueRow[]>(
        "SELECT value FROM org_settings WHERE key_name IN ('ai_api_key', 'anthropic_api_key') LIMIT 1"
      );
      apiKey = keyRows[0]?.value;
    } catch (err) {
      log.warn('Could not read API key from org_settings for stats generation');
    }

    if (!apiKey) {
      await db.execute("UPDATE conversation_stats SET stats_status = 'failed' WHERE id = ?", [statsId]);
      log.warn({ conversationId }, 'No API key for stats generation');
      return;
    }

    // Look up workspace model for this conversation
    const [wsRows] = await db.execute<ModelRow[]>(
      "SELECT w.model FROM workspaces w JOIN conversations c ON c.workspace_id = w.id WHERE c.id = ?",
      [conversationId]
    );
    const statsModel = wsRows[0]?.model || await getDefaultModel();

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: statsModel,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyse this conversation transcript and return ONLY a JSON object (no markdown, no explanation).

Rules:
- Be strictly factual. Only describe what actually happened in the transcript.
- Do not infer, exaggerate, or editorialize. If something happened once, say "once", not "repeatedly".
- Count exactly: if the user asked 2 questions, say "2 questions", not "multiple" or "several".
- The summary must be a neutral, accurate one-sentence description of what the user needed.

Fields:
- sentiment_score: integer 1-5 (1=very negative, 3=neutral, 5=very positive). Base this on explicit language, not assumptions.
- resolution_status: one of "resolved", "unresolved", "escalated", "abandoned". "resolved" = the user got what they needed. "abandoned" = the user stopped responding. "escalated" = the user asked for a human or escalation. "unresolved" = the assistant could not help.
- category: one of "query", "issue", "sales", "feedback", "support", "internal", "other". "query" = information lookup. "issue" = something is broken. "sales" = pricing/purchasing. "feedback" = user giving feedback. "support" = how-to help. "internal" = internal team use.
- compliance_violations: array of {rule: string, description: string} or empty array. Only flag clear violations that actually occurred, not hypothetical risks.
- knowledge_gaps: array of {topic: string, description: string} or empty array. Only include topics where the assistant explicitly could not answer or said it did not have the information.
- fraud_indicators: array of {type: string, description: string, severity: "low"|"medium"|"high"} or empty array. Look for social engineering, identity spoofing, bulk data harvesting, pressure tactics. Only flag if actually suspicious.
- tools_used: array of tool name strings (deduplicated). Only tools that were actually called.
- summary: one factual sentence. Describe what the user asked for and whether they got it. No subjective language.

Conversation transcript:
${transcript}`
      }],
    });

    let text = response.content.filter((b): b is TextBlock => b.type === 'text').map((b) => b.text).join('').trim();
    // Strip markdown fences if the LLM wrapped the JSON
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    }
    const parsed = JSON.parse(text);

    await db.execute(
      `UPDATE conversation_stats SET
        sentiment_score = ?, resolution_status = ?, compliance_violations = ?, knowledge_gaps = ?,
        fraud_indicators = ?, tools_used = ?, total_tokens_input = ?, total_tokens_output = ?, total_cost_usd = ?,
        total_duration_ms = ?, message_count = ?, duration_seconds = ?, summary = ?, category = ?, stats_status = 'complete'
       WHERE id = ?`,
      [
        parsed.sentiment_score || 3,
        parsed.resolution_status || 'unresolved',
        JSON.stringify(parsed.compliance_violations || []),
        JSON.stringify(parsed.knowledge_gaps || []),
        JSON.stringify(parsed.fraud_indicators || []),
        JSON.stringify(parsed.tools_used || []),
        agg[0].ti, agg[0].to2, agg[0].cost, agg[0].dur,
        conv[0]?.message_count || messages.length,
        durationSec,
        parsed.summary || '',
        parsed.category || 'other',
        statsId,
      ]
    );

    log.info({ conversationId, sentiment: parsed.sentiment_score, resolution: parsed.resolution_status }, 'Conversation stats generated');
  } catch (err) {
    await db.execute("UPDATE conversation_stats SET stats_status = 'failed' WHERE id = ?", [statsId]);
    log.error({ conversationId, error: (err as Error).message }, 'Stats generation failed');
  }
}
