/** Shared types for workspace sub-components */

export interface Workspace {
  id: string;
  name: string;
  model: string;
  system_prompt?: string;
  team?: string;
  cold_timeout_minutes?: number;
  close_timeout_minutes?: number;
}

export interface SetupStatus {
  ai_configured: boolean;
  connections: number;
}

export interface Conversation {
  id: string;
  status: string;
  consumer_type: string;
  user_name?: string;
  summary?: string;
  message_count: number;
  category?: string;
  sentiment_score?: number;
  total_cost_usd?: string;
  last_activity_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  meta?: ChatMeta;
}

export interface ChatMeta {
  tools?: string[];
  connections?: string[];
  tokens?: { input: number; output: number };
  cost?: number;
  duration?: number;
}

export interface ModelOption {
  id: string;
  label: string;
  default?: boolean;
}

export interface Connection {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  connection_name?: string;
  is_write: boolean;
}

export interface Consumer {
  id: string;
  type: string;
  status: string;
  config: string;
}

export interface KnowledgeSource {
  id: string;
  name: string;
  type: string;
  status: string;
  chunks?: number;
}

export interface WorkspaceKnowledgeGap {
  topic: string;
  description?: string;
  conversation_id: string;
  user_name?: string;
}

export interface Guardrail {
  id: string;
  rule_type: string;
  enabled: boolean;
  config: string;
}

export interface Violation {
  rule: string;
  description: string;
  conversation_id: string;
  user_name?: string;
}

export interface DashboardData {
  tickets: { open: number; cold: number; closed_today?: number; closed_week: number };
  sentiment: { average: number; distribution?: Record<string | number, number> };
  cost: { today?: number; this_week?: number; this_month: number };
  usage: { queries_today?: number; queries_this_week?: number; queries_this_month: number };
  resolution: Record<string, number>;
  compliance: { total_violations: number; recent?: Array<{ rule: string; description: string }>; by_rule?: Record<string, number> };
  knowledge_gaps: { topics: Array<{ topic: string; count: number; last_seen: string }> };
  categories: Record<string, number>;
  channels: Record<string, number>;
  recent_conversations: Conversation[];
}

export interface SectionDataMap {
  overview: DashboardData;
  connections: { connections: Connection[]; tools: Tool[] };
  consumers: { consumers: Consumer[] };
  knowledge: { knowledge: KnowledgeSource[]; gaps: WorkspaceKnowledgeGap[] };
  compliance: { guardrails: Guardrail[]; violations: Violation[] };
  observability: { conversations: Conversation[]; total: number; filters?: Record<string, string[]> };
  settings: { workspace: Workspace };
}

export type Section = 'overview' | 'connections' | 'consumers' | 'knowledge' | 'compliance' | 'observability' | 'settings';
