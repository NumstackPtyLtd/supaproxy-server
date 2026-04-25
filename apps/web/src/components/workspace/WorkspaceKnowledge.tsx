import { BookOpen, Plus } from 'lucide-react';
import type { KnowledgeSource, WorkspaceKnowledgeGap } from './types';

interface WorkspaceKnowledgeProps {
  knowledge: KnowledgeSource[];
  gaps: WorkspaceKnowledgeGap[];
  subTab: string;
  setSubTab: (v: string) => void;
  onSelectConvo: (id: string) => void;
}

export default function WorkspaceKnowledge({ knowledge, gaps, subTab, setSubTab, onSelectConvo }: WorkspaceKnowledgeProps) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-heading mb-1">Knowledge</h2>
      <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>Knowledge sources and detected gaps from conversations.</p>
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-4" role="tablist">
        {[
          { id: 'default', label: `Gaps (${gaps.length})` },
          { id: 'sources', label: `Sources (${knowledge.length})` },
        ].map(t => {
          const isActive = subTab === t.id || (subTab === 'default' && t.id === 'default');
          return (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${isActive ? 'border-heading text-heading' : ''}`}
            style={isActive
              ? { border: '1px solid var(--text-heading)' }
              : { border: '1px solid var(--border-color)', color: 'var(--body)' }}>
            {t.label}
          </button>
          );
        })}
        {subTab === 'sources' && <button className="ml-auto flex items-center gap-1 text-[12px] font-medium text-heading"><Plus size={12} /> Add source</button>}
      </div>

      {/* Gaps view */}
      {subTab === 'default' && (
        gaps.length > 0 ? (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            {gaps.map((g, i) => (
              <button key={i} onClick={() => onSelectConvo(g.conversation_id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={i < gaps.length - 1 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-heading">{g.topic}</div>
                  {g.description && <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{g.description}</div>}
                </div>
                <div className="flex-shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>{g.user_name || ''}</div>
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg p-4 flex items-center gap-3" style={{ border: '1px solid var(--border-color)' }}>
            <BookOpen size={14} className="text-success flex-shrink-0" />
            <div>
              <div className="text-[12px] font-medium text-success">No knowledge gaps</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>The AI answered all questions using available tools and sources</div>
            </div>
          </div>
        )
      )}

      {/* Sources view */}
      {subTab === 'sources' && (
        knowledge.length === 0 ? (
          <div className="rounded-lg py-8 text-center" style={{ border: '1px solid var(--border-color)' }}>
            <BookOpen size={18} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No knowledge sources yet.</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            {knowledge.map((k, ki) => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-2.5"
                style={ki < knowledge.length - 1 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${k.type === 'confluence' ? 'bg-blue-500/10 text-blue-400' : ''}`}
                  style={k.type !== 'confluence' ? { background: 'var(--bg-hover)', color: 'var(--body)' } : undefined}>
                  {k.type}
                </span>
                <span className="text-[12px] text-heading font-medium flex-1 truncate">{k.name}</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{k.chunks || 0} chunks</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{k.status}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
