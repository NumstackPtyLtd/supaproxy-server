import { fmtDurationSec } from '../shared/ConversationUI';
import type { ConversationStats } from '../../types/conversations';

interface Props {
  messageCount: number;
  stats: ConversationStats | null;
}

export function ConversationMetrics({ messageCount, stats }: Props) {
  return (
    <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
      <div className="flex items-center gap-4 text-[11px]">
        <span style={{ color: 'var(--text-muted)' }}>{messageCount} messages</span>
        {stats && stats.duration_seconds > 0 && <span style={{ color: 'var(--text-muted)' }}>{fmtDurationSec(stats.duration_seconds)}</span>}
        {stats?.total_cost_usd != null && <span className="font-mono" style={{ color: 'var(--text-muted)' }}>${Number(stats.total_cost_usd).toFixed(4)}</span>}
        {stats && stats.total_tokens_input > 0 && <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{(stats.total_tokens_input + (stats.total_tokens_output || 0)).toLocaleString()} tokens</span>}
      </div>
    </div>
  );
}
