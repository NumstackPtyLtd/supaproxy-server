import { MessageSquare, Plus } from 'lucide-react';
import { parseJSON } from '../../lib/utils';
import type { Consumer } from './types';

interface WorkspaceConsumersProps {
  consumers: Consumer[];
  onAddConsumer: () => void;
}

export default function WorkspaceConsumers({ consumers, onAddConsumer }: WorkspaceConsumersProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-heading">Consumers</h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{consumers.length > 0 ? `${consumers.length} active consumers` : 'Add a consumer so users can interact with this workspace'}</p>
        </div>
        <button onClick={onAddConsumer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
          <Plus size={12} /> Add consumer
        </button>
      </div>
      {consumers.length === 0 && (
        <div className="rounded-lg py-10 text-center" style={{ border: '1px solid var(--border-color)' }}>
          <MessageSquare size={20} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No consumers configured yet.</p>
        </div>
      )}
      {consumers.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          {consumers.map((c, ci) => {
            const cfg = parseJSON(c.config);
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5"
                style={ci < consumers.length - 1 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
                <span className="text-[10px] font-medium uppercase w-14" style={{ color: 'var(--body)' }}>{c.type}</span>
                <span className="text-heading font-medium">{String(cfg.channel_name || c.type)}</span>
                <span className="flex-1" />
                <span className={`inline-flex items-center gap-1.5 text-[11px] ${c.status === 'active' ? 'text-success' : ''}`}
                  style={c.status !== 'active' ? { color: 'var(--text-muted)' } : undefined}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-success' : 'bg-muted'}`} />
                  {c.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
