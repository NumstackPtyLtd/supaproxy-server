import ConversationTable from '../shared/ConversationTable';
import FilterDropdown from '../shared/FilterDropdown';
import type { Conversation } from './types';

interface WorkspaceObservabilityProps {
  data: { conversations: Conversation[]; total: number; filters?: Record<string, string[]> };
  activeFilters: Record<string, string>;
  availableFilters: Record<string, string[]>;
  activityLimit: number;
  onFilterChange: (f: Record<string, string>) => void;
  onLoadMore: () => void;
  onSelectConvo: (id: string) => void;
}

export default function WorkspaceObservability({ data, activeFilters, availableFilters, activityLimit, onFilterChange, onLoadMore, onSelectConvo }: WorkspaceObservabilityProps) {
  const convos = data.conversations || [];

  return (
    <div>
      <h2 className="text-sm font-semibold text-heading mb-1">Activity</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>All conversations across this workspace.</p>

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-1.5">
          <FilterDropdown
            filters={availableFilters}
            active={activeFilters}
            onChange={onFilterChange}
          />
          {Object.entries(activeFilters).filter(([,v]) => v).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-heading)', border: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{k}:</span> {v}
              <button onClick={() => { const n = { ...activeFilters }; delete n[k]; onFilterChange(n); }}
                className="ml-0.5" style={{ color: 'var(--text-muted)' }}>&times;</button>
            </span>
          ))}
          {Object.values(activeFilters).some(v => v) && (
            <button onClick={() => onFilterChange({})} className="text-[10px] transition-colors" style={{ color: 'var(--text-muted)' }}>
              Clear
            </button>
          )}
        </div>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{data.total || 0} total</span>
      </div>
      <ConversationTable conversations={convos} onSelect={onSelectConvo} emptyMessage="No conversations yet." />
      {data.total > activityLimit && (
        <button onClick={onLoadMore}
          className="mt-3 px-3 py-1.5 text-[11px] font-medium rounded-sm transition-colors"
          style={{ color: 'var(--body)', border: '1px solid var(--border-color)' }}>
          Load more ({data.total - activityLimit} remaining)
        </button>
      )}
    </div>
  );
}
