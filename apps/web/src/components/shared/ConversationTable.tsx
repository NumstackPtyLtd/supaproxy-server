import { Activity } from 'lucide-react';
import { ChannelIcon, CategoryBadge, StatusPill } from './ConversationUI';
import { sentimentColour, theme } from '../../lib/utils';
import type { Conversation } from '../workspace/types';

interface Props {
  conversations: Conversation[];
  onSelect: (id: string) => void;
  emptyMessage?: string;
}

export default function ConversationTable({ conversations, onSelect, emptyMessage }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-lg py-8 text-center" style={{ border: '1px solid var(--border-color)' }}>
        <Activity size={18} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{emptyMessage || 'No conversations yet.'}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-wide font-medium"
        style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
        <span className="w-14">Status</span>
        <span className="w-4"></span>
        <span className="w-24">User</span>
        <span className="flex-1">Summary</span>
        <span className="w-16">Category</span>
        <span className="w-12 text-right">Sent.</span>
        <span className="w-16 text-right">Cost</span>
        <span className="w-14 text-right">Time</span>
      </div>
      {conversations.map((c, ci) => (
        <button key={c.id} onClick={() => onSelect(c.id)}
          className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
          style={ci < conversations.length - 1 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
          <span className="w-14"><StatusPill status={c.status} /></span>
          <span className="w-4 flex-shrink-0"><ChannelIcon type={c.consumer_type} size={12} /></span>
          <span className="text-[11px] text-heading font-medium truncate w-24">{c.user_name || c.consumer_type}</span>
          <span className="text-[11px] truncate flex-1" style={{ color: 'var(--body)' }}>{c.summary || `${c.message_count} messages`}</span>
          <span className="w-16 flex-shrink-0">{c.category ? <CategoryBadge category={c.category} /> : <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>--</span>}</span>
          <span className="text-[10px] font-mono w-12 text-right flex-shrink-0" style={{ color: c.sentiment_score ? sentimentColour(c.sentiment_score) : theme.muted }}>
            {c.sentiment_score ? `${c.sentiment_score}` : '--'}
          </span>
          <span className="text-[10px] font-mono w-16 text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{c.total_cost_usd ? `$${parseFloat(c.total_cost_usd).toFixed(3)}` : ''}</span>
          <span className="text-[10px] font-mono w-14 text-right flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {c.last_activity_at ? new Date(c.last_activity_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </button>
      ))}
    </div>
  );
}
