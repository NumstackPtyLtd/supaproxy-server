export interface AuditLogData {
  id: string
  workspace_id: string
  conversation_id: string | null
  consumer_type: string | null
  channel: string | null
  user_id: string | null
  user_name: string | null
  query: string
  tools_called: string
  connections_hit: string
  tokens_input: number
  tokens_output: number
  cost_usd: number
  duration_ms: number
  error: string | null
}

export interface AuditLogRepository {
  create(data: AuditLogData): Promise<void>
}
