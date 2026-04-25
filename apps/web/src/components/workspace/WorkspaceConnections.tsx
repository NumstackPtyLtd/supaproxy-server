import { useState } from 'react';
import { Plug, Plus, Loader2 } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { useDeleteConnection } from '../../hooks/useDeleteConnection';
import type { Connection, Tool } from './types';

interface WorkspaceConnectionsProps {
  connections: Connection[];
  tools: Tool[];
  onAddConnection: () => void;
  onRefetch: () => void;
}

export default function WorkspaceConnections({ connections, tools, onAddConnection, onRefetch }: WorkspaceConnectionsProps) {
  const [expandedConn, setExpandedConn] = useState<string | null>(null);
  const [deleteConn, setDeleteConn] = useState<{ id: string; name: string } | null>(null);
  const { deleteState, deleteConnection } = useDeleteConnection(onRefetch);

  const toolsByConn: Record<string, Tool[]> = {};
  for (const t of tools) { const key = t.connection_name || 'unknown'; if (!toolsByConn[key]) toolsByConn[key] = []; toolsByConn[key].push(t); }

  const deleting = deleteState.status === 'submitting';

  const handleDelete = async () => {
    if (!deleteConn) return;
    const success = await deleteConnection(deleteConn.id);
    if (success) {
      setDeleteConn(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-heading">Connections</h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{connections.length > 0 ? `${connections.length} connections · ${tools.length} tools registered` : 'Connect data sources so the AI can answer queries'}</p>
        </div>
        <button onClick={onAddConnection}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
          <Plus size={12} /> Add connection
        </button>
      </div>
      {connections.length === 0 && (
        <div className="rounded-lg py-10 text-center" style={{ border: '1px solid var(--border-color)' }}>
          <Plug size={20} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No connections configured yet.</p>
        </div>
      )}
      {connections.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          {connections.map((c, ci) => {
            const ct = toolsByConn[c.name] || [];
            return (
              <div key={c.id}>
                <div onClick={() => setExpandedConn(expandedConn === c.name ? null : c.name)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                  style={ci < connections.length - 1 || expandedConn === c.name ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
                  <svg className={`w-3 h-3 transition-transform ${expandedConn === c.name ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  <span className="text-[12px] font-medium text-heading">{c.name}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${c.type === 'mcp' ? 'text-heading' : 'bg-blue-500/10 text-blue-400'}`}
                    style={c.type === 'mcp' ? { background: 'var(--bg-hover)' } : undefined}>
                    {c.type}
                  </span>
                  <span className="flex-1" />
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{ct.length} tools</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'connected' ? 'bg-success' : 'bg-muted'}`} />
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConn({ id: c.id, name: c.name }); }}
                    className="transition-colors ml-1"
                    style={{ color: 'var(--text-muted)' }}
                    title="Remove connection"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                {expandedConn === c.name && ct.length > 0 && (
                  <div style={ci < connections.length - 1 ? { background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' } : { background: 'var(--bg-surface)' }}>
                    {ct.map((t, ti) => (
                      <div key={t.id} className="flex items-center gap-3 py-1.5 pl-10 pr-4 text-[11px]"
                        style={ti < ct.length - 1 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
                        <span className="font-mono text-heading">{t.name}</span>
                        <span className="truncate" style={{ color: 'var(--body)' }}>{t.description}</span>
                        <span className="ml-auto flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t.is_write ? 'write' : 'read'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete connection confirmation */}
      {deleteConn && (
        <Modal onClose={() => setDeleteConn(null)} title="Delete connection" maxWidth="max-w-[400px]">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </div>
              <div>
                <div className="text-[14px] font-semibold text-heading">Remove connection</div>
                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>This will delete all discovered tools.</div>
              </div>
            </div>
            <div className="mb-5 px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <span className="text-[12px] font-mono text-heading">{deleteConn.name}</span>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConn(null)} disabled={deleting}
                className="px-4 py-2 rounded-sm text-[12px] font-medium transition-colors"
                style={{ color: 'var(--body)', border: '1px solid var(--border-color)' }}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-[12px] font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? <><Loader2 size={12} className="animate-spin" /> Removing...</> : 'Remove'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
