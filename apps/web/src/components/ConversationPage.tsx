import { useState, useMemo } from 'react';
import { CheckCircle, Loader2, Users, Flag } from 'lucide-react';
import { ErrorBoundary } from './shared/ErrorBoundary';
import Breadcrumbs from './Breadcrumbs';
import { useConversation } from '../hooks/useConversation';
import { buildTimeline, type ConversationData } from '../types/conversations';
import { getConsumer } from '../lib/registries/consumers';
import { StatusPill, CategoryBadge, UserAvatar } from './shared/ConversationUI';
import { renderTimelineEvent } from './conversation/TimelineEvents';
import { ConversationSidebar } from './conversation/ConversationSidebar';

type PageTab = 'timeline' | 'internal' | 'actions';

const TABS: { id: PageTab; label: string; soon?: boolean }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'internal', label: 'Internal notes', soon: true },
  { id: 'actions', label: 'Actions', soon: true },
];

export default function ConversationPage({ workspaceId, conversationId }: {
  workspaceId: string;
  conversationId: string;
}) {
  const { state, wsName, closeConversation, closeStatus } = useConversation(workspaceId, conversationId);
  const [tab, setTab] = useState<PageTab>('timeline');
  const [closing, setClosing] = useState(false);

  if (state.status === 'idle' || state.status === 'loading') {
    return <div className="text-[13px] py-8" style={{ color: 'var(--text-muted)' }}>Loading...</div>;
  }
  if (state.status === 'error') {
    return <div className="text-[13px] text-error py-8">Failed to load conversation</div>;
  }

  const { conversation, stats } = state.data;

  return (
    <ErrorBoundary>
    <div className="text-[13px]">
      <div className="py-2">
        <Breadcrumbs items={[
          { label: 'Workspaces', href: '/workspaces' },
          { label: wsName || 'Workspace', href: `/workspaces/${workspaceId}?tab=observability` },
          { label: conversationId.slice(0, 8) },
        ]} />
      </div>

      <PageHeader
        conversation={conversation}
        stats={stats}
        conversationId={conversationId}
        closeStatus={closeStatus}
        closing={closing}
        onClose={async () => {
          setClosing(true);
          try { await closeConversation(); } catch { /* closeStatus updated by hook */ }
          setClosing(false);
        }}
      />

      {/* 200px = header (48px) + breadcrumbs (40px) + page header (~80px) + padding (32px) */}
      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className="flex-1 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab} />
          {tab === 'timeline' && <Timeline data={state.data} />}
          {tab === 'internal' && <ComingSoon icon={<Users size={20} />} title="Internal notes coming soon." subtitle="Team members will be able to discuss this conversation privately." />}
          {tab === 'actions' && <ComingSoon icon={<Flag size={20} />} title="Actions coming soon." subtitle="Escalate, take over, assign, or flag conversations." />}
        </div>
        <ConversationSidebar conversation={conversation} stats={stats} />
      </div>
    </div>
    </ErrorBoundary>
  );
}

/* ── Page header ── */

interface PageHeaderProps {
  conversation: ConversationData['conversation'];
  stats: ConversationData['stats'];
  conversationId: string;
  closeStatus: string;
  closing: boolean;
  onClose: () => void;
}

function PageHeader({ conversation, stats, conversationId, closeStatus, closing, onClose }: PageHeaderProps) {
  const consumer = getConsumer(conversation.consumer_type);

  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <div className="flex items-center gap-2.5 mb-1.5">
          <UserAvatar name={conversation.user_name ?? undefined} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-heading">{conversation.user_name || 'Unknown user'}</h1>
              <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{conversationId.slice(0, 8)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StatusPill status={conversation.status} />
              {stats?.category && <CategoryBadge category={stats.category} />}
              <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <consumer.icon size={11} />
                {consumer.label}
              </span>
            </div>
          </div>
        </div>
        {stats?.summary && (
          <p className="text-[12px] max-w-[600px] mt-1" style={{ color: 'var(--text-muted)' }}>{stats.summary}</p>
        )}
      </div>
      <div className="flex gap-2 items-center">
        {closeStatus && <CloseStatusLabel status={closeStatus} />}
        {conversation.status !== 'closed' && (
          <button
            onClick={onClose}
            disabled={closing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium transition-colors"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
          >
            {closing
              ? <><Loader2 size={11} className="animate-spin" /> Closing...</>
              : <><CheckCircle size={11} /> Close & Analyse</>}
          </button>
        )}
      </div>
    </div>
  );
}

function CloseStatusLabel({ status }: { status: string }) {
  const isAnalysing = status.includes('analysing');
  const isComplete = status.includes('complete');

  return (
    <span
      className="text-[11px] flex items-center gap-1.5"
      style={{ color: isAnalysing ? 'var(--color-warning)' : isComplete ? 'var(--color-success)' : 'var(--body)' }}
    >
      {isAnalysing && <Loader2 size={11} className="animate-spin" />}
      {isComplete && <CheckCircle size={11} />}
      {status}
    </span>
  );
}

/* ── Tab bar ── */

function TabBar({ tabs, active, onChange }: { tabs: typeof TABS; active: PageTab; onChange: (t: PageTab) => void }) {
  return (
    <div className="flex items-center gap-1 mb-4 border-b" role="tablist" style={{ borderColor: 'var(--border-color)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          tabIndex={active === t.id ? 0 : -1}
          onClick={() => !t.soon && onChange(t.id)}
          disabled={t.soon}
          className={`px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors ${
            active === t.id
              ? 'border-current text-heading'
              : t.soon
                ? 'border-transparent cursor-not-allowed'
                : 'border-transparent hover:text-heading'
          }`}
          style={active !== t.id ? { color: t.soon ? 'var(--text-muted)' : 'var(--body)' } : undefined}
        >
          {t.label}
          {t.soon && <span className="ml-1 text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>soon</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Timeline ── */

function Timeline({ data }: { data: ConversationData }) {
  const timeline = useMemo(() => buildTimeline(data), [data]);
  const userName = data.conversation.user_name;

  return (
    <div className="relative pb-8">
      <div className="absolute left-[9px] top-3 bottom-3 w-px" style={{ background: 'var(--border-color)', opacity: 0.5 }} />
      <div className="space-y-0">
        {timeline.map((ev, i) => renderTimelineEvent(ev, i, userName ?? 'Unknown'))}
      </div>
    </div>
  );
}

/* ── Coming soon placeholder ── */

function ComingSoon({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="border rounded-lg py-12 text-center" style={{ borderColor: 'var(--border-color)' }}>
      <div className="mx-auto mb-2" style={{ color: 'var(--text-muted)', width: 'fit-content' }}>{icon}</div>
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{title}</p>
      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
    </div>
  );
}
