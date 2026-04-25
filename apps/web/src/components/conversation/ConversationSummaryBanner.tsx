import { sentimentColour } from '../../lib/utils';
import { StatusPill, CategoryBadge, ChannelBadge, UserAvatar } from '../shared/ConversationUI';
import type { ConversationStats } from '../../types/conversations';

interface Props {
  userName: string;
  consumerType: string;
  stats: ConversationStats | null;
}

export function ConversationSummaryBanner({ userName, consumerType, stats }: Props) {
  return (
    <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
      {/* User + channel row */}
      <div className="flex items-center gap-3 mb-3">
        <UserAvatar name={userName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-heading">{userName || 'Unknown user'}</span>
            <ChannelBadge type={consumerType} size={12} />
          </div>
          {stats?.summary && (
            <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{stats.summary}</p>
          )}
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {stats?.category && <CategoryBadge category={stats.category} />}
        {stats?.resolution_status && <StatusPill status={stats.resolution_status} />}
        {stats?.sentiment_score != null && stats.sentiment_score > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none" style={{ background: 'var(--bg-surface)', color: sentimentColour(stats.sentiment_score) }}>
            {stats.sentiment_score}/5
          </span>
        )}
      </div>
    </div>
  );
}
