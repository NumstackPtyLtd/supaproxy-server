import { ChannelIcon, CategoryBadge } from '../shared/ConversationUI';
import ConversationTable from '../shared/ConversationTable';
import { getConsumer } from '../../lib/registries/consumers';
import SetupChecklist from './SetupChecklist';
import type { DashboardData, SetupStatus, Section } from './types';

type ActiveModal = 'connection' | 'consumer' | 'test' | null;

interface WorkspaceOverviewProps {
  data: DashboardData;
  setupStatus: SetupStatus | null;
  setSection: (s: Section) => void;
  openModal: (modal: ActiveModal) => void;
  onSelectConvo: (id: string) => void;
}

export default function WorkspaceOverview({ data, setupStatus, setSection, openModal, onSelectConvo }: WorkspaceOverviewProps) {
  const d = data;

  // Guard: data may briefly hold stale shape from a different section during tab switch
  if (!d.tickets) return null;

  // Setup checklist if no conversations yet
  const hasConnections = setupStatus?.connections && setupStatus.connections > 0;
  const hasAi = setupStatus?.ai_configured;
  const needsSetup = !hasAi || !hasConnections;

  if (d.tickets.open === 0 && d.tickets.closed_week === 0 && needsSetup && setupStatus) {
    return (
      <SetupChecklist
        setupStatus={setupStatus}
        setSection={setSection}
        openModal={openModal}
      />
    );
  }

  const totalConvos = d.tickets.open + d.tickets.cold + d.tickets.closed_week;
  const res = d.resolution;
  const totalResolved = (res.resolved || 0) + (res.unresolved || 0) + (res.escalated || 0) + (res.abandoned || 0);
  const avgCost = totalConvos > 0 ? d.cost.this_month / totalConvos : 0;
  const complianceScore = totalResolved > 0 ? Math.round(((totalResolved - d.compliance.total_violations) / totalResolved) * 100) : 100;
  const gapScore = d.knowledge_gaps.topics.length;

  const sentDist = d.sentiment.distribution || {};
  const catMap: Record<string, number> = d.categories || {};
  const chanMap: Record<string, number> = d.channels || {};

  return (
    <div className="space-y-6">
      {/* Stat cards row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Conversations</div>
          <div className="text-[20px] font-semibold text-heading">{totalConvos}</div>
          <div className="flex gap-3 mt-2 text-[11px]">
            <span style={{ color: 'var(--color-info)' }}>{d.tickets.open} open</span>
            <span style={{ color: 'var(--color-warning)' }}>{d.tickets.cold} cold</span>
          </div>
        </div>
        <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Sentiment</div>
          <div className="text-[20px] font-semibold text-heading">{d.sentiment.average > 0 ? d.sentiment.average.toFixed(1) : '--'}<span className="text-[12px] font-normal" style={{ color: 'var(--text-muted)' }}>/5</span></div>
          {/* Mini sentiment bar */}
          <div className="flex gap-px mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bar-track)' }}>
            {[1, 2, 3, 4, 5].map(s => {
              const count = sentDist[s] || 0;
              const pct = totalResolved > 0 ? (count / totalResolved) * 100 : 0;
              if (pct === 0) return null;
              const colors = ['', 'var(--sentiment-negative)', 'var(--sentiment-low)', 'var(--sentiment-neutral)', 'var(--sentiment-positive)', 'var(--sentiment-very-positive)'];
              return <div key={s} className="transition-all" style={{ width: `${pct}%`, background: colors[s] }} />;
            })}
          </div>
        </div>
        <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Spend this month</div>
          <div className="text-[20px] font-semibold text-heading font-mono">${d.cost.this_month.toFixed(2)}</div>
          <div className="text-[11px] mt-2 font-mono" style={{ color: 'var(--text-muted)' }}>${avgCost.toFixed(3)} avg · {d.usage.queries_this_month} queries</div>
        </div>
        <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Resolution</div>
          <div className="text-[20px] font-semibold text-heading">{totalResolved > 0 ? Math.round(((res.resolved || 0) / totalResolved) * 100) : '--'}<span className="text-[12px] font-normal" style={{ color: 'var(--text-muted)' }}>%</span></div>
          <div className="flex gap-px mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bar-track)' }}>
            {totalResolved > 0 && (
              <>
                {(res.resolved || 0) > 0 && <div style={{ width: `${((res.resolved || 0) / totalResolved) * 100}%`, background: 'var(--color-success)' }} />}
                {(res.unresolved || 0) > 0 && <div style={{ width: `${((res.unresolved || 0) / totalResolved) * 100}%`, background: 'var(--sentiment-neutral)' }} />}
                {(res.escalated || 0) > 0 && <div style={{ width: `${((res.escalated || 0) / totalResolved) * 100}%`, background: 'var(--color-warning)' }} />}
                {(res.abandoned || 0) > 0 && <div style={{ width: `${((res.abandoned || 0) / totalResolved) * 100}%`, background: 'var(--color-danger)' }} />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Categories */}
        <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
          <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>By category</div>
          {Object.keys(catMap).length > 0 ? (
            <div className="space-y-1.5">
              {Object.entries(catMap).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between">
                  <CategoryBadge category={cat} />
                  <span className="text-[11px] text-heading font-medium">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Categories will appear once conversations are analysed.</p>
          )}
        </div>

        {/* Channels */}
        <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
          <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>By channel</div>
          {Object.keys(chanMap).length > 0 ? (
            <div className="space-y-1.5">
              {Object.entries(chanMap).map(([ch, count]) => (
                <div key={ch} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-heading">
                    <ChannelIcon type={ch} size={12} />
                    {getConsumer(ch).label}
                  </span>
                  <span className="text-[11px] text-heading font-medium">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No conversations yet.</p>
          )}
        </div>

        {/* Compliance & Gaps */}
        <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
          <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Compliance</div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[18px] font-semibold text-heading">{complianceScore}%</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>compliant</span>
          </div>
          {d.compliance.total_violations > 0 && (
            <div className="text-[11px] text-error mb-1">{d.compliance.total_violations} violation{d.compliance.total_violations > 1 ? 's' : ''}</div>
          )}
          {gapScore > 0 ? (
            <div className="text-[11px]" style={{ color: 'var(--color-warning)' }}>{gapScore} knowledge gap{gapScore > 1 ? 's' : ''}</div>
          ) : (
            <div className="text-[11px] text-success">No knowledge gaps</div>
          )}
        </div>
      </div>

      {/* Recent conversations */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Recent conversations</span>
          <button onClick={() => setSection('observability')} className="text-[11px] text-heading hover:text-heading-hover">View all</button>
        </div>
        <ConversationTable conversations={d.recent_conversations} onSelect={onSelectConvo} emptyMessage="No conversations yet. Queries will appear here as tickets." />
      </div>
    </div>
  );
}
