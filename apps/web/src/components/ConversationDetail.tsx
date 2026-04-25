import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, X, ExternalLink, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import { StatusPill, UserAvatar, safeParseJSON } from './shared/ConversationUI';
import { ConversationSummaryBanner } from './conversation/ConversationSummaryBanner';
import { ConversationMetrics } from './conversation/ConversationMetrics';
import { useConversationDetail } from '../hooks/useConversationDetail';
import type { ComplianceViolation, KnowledgeGap } from '../types/conversations';

type SlideState = 'entering' | 'visible' | 'closing' | 'closed';

export default function ConversationDetail({ workspaceId, conversationId, onClose }: {
  workspaceId: string;
  conversationId: string;
  onClose: () => void;
}) {
  const [slideState, setSlideState] = useState<SlideState>('entering');
  const {
    fetchState,
    closeMutation,
    closeMessage,
    closeConversation,
    closeAnimationMs,
  } = useConversationDetail(workspaceId, conversationId);

  useEffect(() => {
    requestAnimationFrame(() => setSlideState('visible'));
  }, []);

  const handleClose = useCallback(() => {
    setSlideState('closing');
    setTimeout(onClose, closeAnimationMs);
  }, [onClose, closeAnimationMs]);

  // Escape key handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const data = fetchState.status === 'success' ? fetchState.data : null;
  const conv = data?.conversation;
  const stats = data?.stats ?? null;
  const closing = closeMutation.status === 'submitting';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`absolute inset-0 transition-opacity duration-200 ${slideState === 'visible' ? 'bg-black/30' : 'bg-black/0'}`} />
      <div className={`relative w-[480px] h-full shadow-xl overflow-y-auto transition-transform duration-200 ease-out ${slideState === 'visible' ? 'translate-x-0' : 'translate-x-full'}`} style={{ background: 'var(--bg-card)' }}>
        {/* Header */}
        <div className="sticky top-0 z-10" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-heading" />
              <h2 className="text-[13px] font-semibold text-heading">Conversation</h2>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{conversationId.slice(0, 8)}</span>
              {conv && <StatusPill status={conv.status} />}
            </div>
            <div className="flex items-center gap-2">
              {conv && conv.status !== 'closed' && (
                <button
                  onClick={closeConversation}
                  disabled={closing}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-medium transition-colors"
                  style={{ border: '1px solid var(--border-color)', color: 'var(--body)' }}
                >
                  {closing ? <><Loader2 size={10} className="animate-spin" /> Closing...</> : 'Close & Analyse'}
                </button>
              )}
              <button onClick={handleClose} className="transition-colors" style={{ color: 'var(--text-muted)' }} aria-label="Close panel"><X size={16} /></button>
            </div>
          </div>
        </div>

        {closeMessage && (
          <div className="px-5 py-2.5 flex items-center gap-2 text-[11px]" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
            {closeMessage.includes('analysing') || closeMessage.includes('Analysing') ? (
              <Loader2 size={12} className="animate-spin text-emerald-400" />
            ) : closeMessage.includes('complete') ? (
              <span className="text-emerald-400">&#10003;</span>
            ) : null}
            <span style={{ color: closeMessage.includes('Failed') ? 'var(--color-error)' : 'var(--body)' }}>{closeMessage}</span>
          </div>
        )}

        {data ? (
          <div>
            <ConversationSummaryBanner
              userName={conv!.user_name ?? 'Unknown'}
              consumerType={conv!.consumer_type}
              stats={stats}
            />

            <ConversationMetrics messageCount={conv!.message_count} stats={stats} />

            {/* Violations & gaps */}
            {stats?.stats_status === 'complete' && (() => {
              const violations: ComplianceViolation[] = safeParseJSON(stats.compliance_violations);
              const gaps: KnowledgeGap[] = safeParseJSON(stats.knowledge_gaps);
              if (violations.length === 0 && gaps.length === 0) return null;
              return (
                <div className="px-5 py-3 space-y-2.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {violations.map((v: ComplianceViolation, i: number) => (
                    <div key={`v${i}`} className="flex items-start gap-2">
                      <AlertTriangle size={12} className="text-error mt-0.5 flex-shrink-0" />
                      <div className="text-[11px]">
                        <span className="text-error font-medium">{v.rule}</span>
                        <span style={{ color: 'var(--text-muted)' }}> — {v.description}</span>
                      </div>
                    </div>
                  ))}
                  {gaps.map((g: KnowledgeGap, i: number) => (
                    <div key={`g${i}`} className="flex items-start gap-2">
                      <HelpCircle size={12} className="text-warning mt-0.5 flex-shrink-0" />
                      <div className="text-[11px]">
                        <span className="text-warning font-medium">{g.topic}</span>
                        <span style={{ color: 'var(--text-muted)' }}> — {g.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Message preview */}
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <h3 className="text-[11px] uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Messages</h3>
              <div className="space-y-2.5">
                {(data.messages || []).slice(0, 6).map((m) => (
                  <div key={m.id} className="flex gap-2.5 items-start">
                    <UserAvatar name={m.role === 'user' ? (conv!.user_name ?? undefined) : 'AI'} />
                    <div className="min-w-0 flex-1">
                      <span className={`text-[10px] font-medium ${m.role === 'user' ? 'text-heading' : ''}`} style={m.role !== 'user' ? { color: 'var(--text-muted)' } : undefined}>
                        {m.role === 'user' ? (conv!.user_name || 'User') : 'Assistant'}
                      </span>
                      <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: 'var(--body)' }}>{m.content}</p>
                    </div>
                  </div>
                ))}
                {(data.messages || []).length > 6 && (
                  <p className="text-[10px] pl-7" style={{ color: 'var(--text-muted)' }}>+{data.messages.length - 6} more messages</p>
                )}
              </div>
            </div>

            {/* View full detail */}
            <div className="px-5 py-4">
              <a href={`/workspaces/${workspaceId}/conversations/${conversationId}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-[12px] font-medium transition-colors"
                style={{ border: '1px solid var(--border-color)', color: 'var(--body)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <ExternalLink size={13} />
                View full conversation
              </a>
            </div>
          </div>
        ) : (
          <div className="p-5 text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        )}
      </div>
    </div>
  );
}
