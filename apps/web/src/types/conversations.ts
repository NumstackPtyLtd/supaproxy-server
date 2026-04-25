export interface Conversation {
  id: string;
  workspace_id: string;
  consumer_type: string;
  channel: string | null;
  external_thread_id: string | null;
  user_name: string | null;
  status: string; // open, cold, closed
  message_count: number;
  first_message_at: string | null;
  last_activity_at: string | null;
  cold_at: string | null;
  closed_at: string | null;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  tools_called: string; // JSON string
  connections_hit: string; // JSON string
  tokens_input: number;
  tokens_output: number;
  cost_usd: string;
  duration_ms: number;
  query_error: string | null;
  created_at: string;
}

export interface ConversationStats {
  conversation_id: string;
  stats_status: 'pending' | 'processing' | 'complete' | 'error' | 'failed';
  summary: string | null;
  category: string | null;
  sentiment_score: number;
  resolution_status: string | null;
  duration_seconds: number;
  total_cost_usd: string;
  total_tokens_input: number;
  total_tokens_output: number;
  tools_used: string; // JSON string
  compliance_violations: string; // JSON string
  knowledge_gaps: string; // JSON string
  fraud_indicators: string; // JSON string
}

export interface ConversationData {
  conversation: Conversation;
  messages: ConversationMessage[];
  stats: ConversationStats | null;
}

export type TimelineEvent =
  | { type: 'opened'; time: string; data: Conversation }
  | { type: 'message'; time: string; data: ConversationMessage }
  | { type: 'cold'; time: string; data: Conversation }
  | { type: 'closed'; time: string; data: { conversation: Conversation; stats: ConversationStats | null } }
  | { type: 'violation'; time: string; data: { rule: string; description: string } }
  | { type: 'gap'; time: string; data: { topic: string; description: string } };

export interface ComplianceViolation {
  rule: string;
  description: string;
  timestamp?: string;
}

export interface KnowledgeGap {
  topic: string;
  description: string;
  timestamp?: string;
}

export interface FraudIndicator {
  type: string;
  severity: string;
  description: string;
}

function parseJSON<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function buildTimeline(data: ConversationData): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const { conversation, messages, stats } = data;

  // Opened event
  if (conversation.first_message_at) {
    events.push({
      type: 'opened',
      time: conversation.first_message_at,
      data: conversation,
    });
  }

  // Message events
  for (const msg of messages) {
    events.push({
      type: 'message',
      time: msg.created_at,
      data: msg,
    });
  }

  // Cold event
  if (conversation.cold_at) {
    events.push({
      type: 'cold',
      time: conversation.cold_at,
      data: conversation,
    });
  }

  // Closed event
  if (conversation.closed_at) {
    events.push({
      type: 'closed',
      time: conversation.closed_at,
      data: { conversation, stats },
    });
  }

  // Violations from stats
  if (stats) {
    const violations = parseJSON<ComplianceViolation>(stats.compliance_violations, []);
    for (const v of violations) {
      events.push({
        type: 'violation',
        time: v.timestamp ?? conversation.closed_at ?? conversation.last_activity_at ?? '',
        data: { rule: v.rule, description: v.description },
      });
    }

    const gaps = parseJSON<KnowledgeGap>(stats.knowledge_gaps, []);
    for (const g of gaps) {
      events.push({
        type: 'gap',
        time: g.timestamp ?? conversation.closed_at ?? conversation.last_activity_at ?? '',
        data: { topic: g.topic, description: g.description },
      });
    }
  }

  // Sort ascending by time
  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return events;
}
