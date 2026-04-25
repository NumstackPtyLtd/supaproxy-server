import type { Conversation, ConversationStats } from '../../types/conversations';
import { sentimentColour } from '../../lib/utils';
import {
  StatusPill, CategoryBadge, ChannelBadge, UserAvatar,
  fmtDateTime, fmtDurationSec,
} from '../shared/ConversationUI';
import { ToolsSection, FraudSection, ViolationsGapsSection } from './SidebarSections';

function SidebarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

function SidebarDivider() {
  return <div className="pt-3" style={{ borderTop: '1px solid var(--border-color)' }} />;
}

export function ConversationSidebar({ conversation, stats }: { conversation: Conversation; stats: ConversationStats | null }) {
  const isComplete = stats?.stats_status === 'complete';

  return (
    <div className="w-[280px] flex-shrink-0">
      <div className="rounded-lg sticky top-16" style={{ border: '1px solid var(--border-color)' }}>
        {/* Analysis summary */}
        {isComplete && stats.summary && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
            <h3 className="text-2xs uppercase tracking-wide font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>AI Analysis</h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--body)' }}>{stats.summary}</p>
          </div>
        )}

        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h3 className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Details</h3>
        </div>

        <div className="px-4 py-3 space-y-3 text-xs">
          {/* User */}
          <SidebarRow label="Initiated by">
            <div className="flex items-center gap-1.5">
              <UserAvatar name={conversation.user_name ?? undefined} />
              <span className="font-medium" style={{ color: 'var(--text-heading)' }}>{conversation.user_name || 'Unknown'}</span>
            </div>
          </SidebarRow>

          {/* Channel */}
          <SidebarRow label="Channel">
            <ChannelBadge type={conversation.consumer_type} size={12} />
          </SidebarRow>

          {conversation.channel && (
            <SidebarRow label="Channel ID">
              <span className="font-mono text-2xs" style={{ color: 'var(--text-heading)' }}>{conversation.channel}</span>
            </SidebarRow>
          )}

          {/* Analysis */}
          {isComplete && (
            <>
              <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sentiment</span>
                <span className="font-medium font-mono" style={{ color: sentimentColour(stats.sentiment_score) }}>{stats.sentiment_score}/5</span>
              </div>
              <SidebarRow label="Resolution">
                <StatusPill status={stats.resolution_status || ''} />
              </SidebarRow>
              {stats.category && (
                <SidebarRow label="Category">
                  <CategoryBadge category={stats.category} />
                </SidebarRow>
              )}
            </>
          )}

          {/* Metrics */}
          <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Messages</span>
            <span className="font-medium" style={{ color: 'var(--text-heading)' }}>{conversation.message_count}</span>
          </div>
          {stats && stats.duration_seconds > 0 && (
            <SidebarRow label="Duration">
              <span className="font-medium" style={{ color: 'var(--text-heading)' }}>{fmtDurationSec(stats.duration_seconds)}</span>
            </SidebarRow>
          )}
          <SidebarRow label="Cost">
            <span className="font-mono font-medium" style={{ color: 'var(--text-heading)' }}>
              ${stats?.total_cost_usd ? parseFloat(stats.total_cost_usd).toFixed(4) : '0.0000'}
            </span>
          </SidebarRow>
          <SidebarRow label="Tokens">
            <span className="font-mono text-2xs" style={{ color: 'var(--text-heading)' }}>
              {(stats?.total_tokens_input || 0).toLocaleString()} in / {(stats?.total_tokens_output || 0).toLocaleString()} out
            </span>
          </SidebarRow>

          {/* Timestamps */}
          <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Opened</span>
            <span className="text-2xs" style={{ color: 'var(--text-heading)' }}>{conversation.first_message_at ? fmtDateTime(conversation.first_message_at) : '--'}</span>
          </div>
          {conversation.cold_at && (
            <SidebarRow label="Went cold">
              <span className="text-2xs" style={{ color: 'var(--text-heading)' }}>{fmtDateTime(conversation.cold_at)}</span>
            </SidebarRow>
          )}
          {conversation.closed_at && (
            <SidebarRow label="Closed">
              <span className="text-2xs" style={{ color: 'var(--text-heading)' }}>{fmtDateTime(conversation.closed_at)}</span>
            </SidebarRow>
          )}

          {/* Tools */}
          <ToolsSection stats={stats} />

          {/* Fraud indicators */}
          {isComplete && <FraudSection stats={stats} />}

          {/* Violations & gaps */}
          {isComplete && <ViolationsGapsSection stats={stats} />}

          {/* Assignment */}
          <div className="pt-3 space-y-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <SidebarRow label="Assigned to">
              <span className="text-2xs" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>Unassigned</span>
            </SidebarRow>
            <SidebarRow label="Escalation">
              <span className="text-2xs" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>None</span>
            </SidebarRow>
          </div>
        </div>
      </div>
    </div>
  );
}

