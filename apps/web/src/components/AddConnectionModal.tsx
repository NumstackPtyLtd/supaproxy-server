import { Loader2, Check, Send, Sparkles } from 'lucide-react';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { HField, Input } from './shared/FormFields';
import { Modal } from './shared/Modal';
import { useMcpConnection } from '../hooks/useMcpConnection';
import { CONNECTIONS } from '../lib/registries/connections';


interface Props { workspaceId: string; onClose: () => void; onSaved: () => void }

const css = {
  border: { border: '1px solid var(--border-color)' },
  heading: { color: 'var(--text-heading)' },
  muted: { color: 'var(--text-muted)' },
  body: { color: 'var(--body)' },
  surface: { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--body)' },
  primary: { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' },
  secondary: { color: 'var(--body)', border: '1px solid var(--border-color)' },
} as const;

export default function AddConnectionModal({ workspaceId, onClose, onSaved }: Props) {
  const { form, updateForm, flowState, test, save, tryQuery, setTryQuery, tryAnswer, tryLoading, tryIt } =
    useMcpConnection();

  const isBusy = flowState.status === 'testing' || flowState.status === 'saving';
  const testOk = flowState.status === 'test-passed' ? flowState.result : null;
  const testFail = flowState.status === 'test-failed' ? flowState.error : null;
  const errorMsg = flowState.status === 'error' ? flowState.message : null;
  const isSaved = flowState.status === 'saved';
  const savedResult = isSaved ? flowState.result : null;

  if (isSaved && savedResult) return (
    <Modal onClose={onClose} title="Connection ready">
    <ErrorBoundary>
    <div className="px-5 py-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center"><Check size={20} className="text-emerald-400" /></div>
        <div>
          <div className="text-[14px] font-semibold" style={css.heading}>{form.name} connected</div>
          <div className="text-[12px]" style={css.muted}>{savedResult.tools ? `${savedResult.tools} tools available` : 'Connection saved'}</div>
        </div>
      </div>
      {savedResult.toolNames && savedResult.toolNames.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-wider mb-2" style={css.muted}>Available tools</div>
          <div className="flex flex-wrap gap-1.5">
            {savedResult.toolNames.slice(0, 12).map(t => (
              <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded" style={css.surface}>{t}</span>
            ))}
            {savedResult.toolNames.length > 12 && <span className="text-[10px] px-2 py-0.5" style={css.muted}>+ {savedResult.toolNames.length - 12} more</span>}
          </div>
        </div>
      )}
      <div className="rounded-lg p-4" style={{ ...css.border, background: 'color-mix(in srgb, var(--bg-surface) 50%, transparent)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={css.heading} /><span className="text-[12px] font-medium" style={css.heading}>Try it out</span>
        </div>
        <div className="text-[11px] mb-3" style={css.muted}>Ask a question to test your new connection.</div>
        <div className="flex gap-2">
          <input value={tryQuery} onChange={e => setTryQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !tryLoading) tryIt(workspaceId); }}
            placeholder="e.g. What tools are available?" className="flex-1 px-3 py-2 rounded-sm text-[12px] focus:outline-none"
            style={{ background: 'var(--bg-card)', ...css.border, color: 'var(--text-heading)' }} />
          <button onClick={() => tryIt(workspaceId)} disabled={tryLoading || !tryQuery.trim()} aria-label="Send query"
            className="px-3 py-2 rounded-sm text-[12px] font-medium disabled:opacity-50 transition-colors hover:opacity-90" style={css.primary}>
            {tryLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </button>
        </div>
        {tryAnswer && <div className="mt-3 px-3 py-2.5 rounded-sm text-[12px] leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto" style={{ background: 'var(--bg-card)', ...css.border, color: 'var(--body)' }}>{tryAnswer}</div>}
      </div>
      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-sm text-[12px] font-medium transition-colors hover:opacity-90" style={css.primary}>Done</button>
      </div>
    </div>
    </ErrorBoundary>
    </Modal>
  );

  const transportBtn = (type: 'http' | 'stdio', label: string, extra?: React.CSSProperties) => (
    <button onClick={() => updateForm({ transport: type })} className="flex-1 py-2 text-[12px] font-medium transition-colors"
      style={{ background: form.transport === type ? 'var(--bg-hover)' : 'transparent', color: form.transport === type ? 'var(--text-heading)' : 'var(--body)', ...extra }}>
      {label}
    </button>
  );

  return (
    <Modal onClose={onClose} title="Add connection"><ErrorBoundary>
    <div className="px-5 pt-4 pb-0">
      <div className="flex gap-2">
        {Object.entries(CONNECTIONS).map(([id, conn]) => {
          const Icon = conn.icon; const isActive = id === 'mcp';
          return (
            <button key={id} onClick={() => { if (conn.enabled) { /* connection type selection - currently only MCP supported */ } }}
              className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-sm text-[11px] font-medium transition-colors"
              style={{
                border: `1px solid ${isActive ? 'var(--input-focus)' : 'var(--border-color)'}`,
                color: isActive ? 'var(--text-heading)' : conn.enabled ? 'var(--text-muted)' : 'color-mix(in srgb, var(--text-muted) 40%, transparent)',
                background: isActive ? 'var(--bg-surface)' : 'transparent', cursor: conn.enabled ? 'pointer' : 'default',
              }}>
              <Icon className="w-4 h-4" /><span>{conn.label}</span>
              {!conn.enabled && <span className="text-[9px]" style={{ color: 'color-mix(in srgb, var(--text-muted) 40%, transparent)' }}>soon</span>}
            </button>
          );
        })}
      </div>
    </div>
    <div className="px-5 py-5 text-[13px]">
      {errorMsg && <div className="mb-4 py-2 text-[12px] text-error border-l-2 border-error pl-3">{errorMsg}</div>}
      {form.transport !== undefined && (
        <div>
          <div className="rounded-lg" style={css.border}>
            <HField label="Connection name" help="A short identifier for this connection">
              <Input value={form.name} onChange={v => updateForm({ name: v })} placeholder="order-service" mono />
            </HField>
            <HField label="Transport" help="How to connect to the MCP server.">
              <div className="flex gap-0 rounded-sm overflow-hidden" style={css.border}>
                {transportBtn('http', 'Cloud / HTTP')}
                {transportBtn('stdio', 'Self-hosted', { borderLeft: '1px solid var(--border-color)' })}
              </div>
            </HField>
            {form.transport === 'http' && <HField label="Server URL" help="The MCP server endpoint"><Input value={form.url} onChange={v => updateForm({ url: v })} placeholder="https://mcp.example.com" mono /></HField>}
            {form.transport === 'stdio' && <>
              <HField label="Command" help="The executable to spawn the MCP server process"><Input value={form.command} onChange={v => updateForm({ command: v })} placeholder="node" mono /></HField>
              <HField label="Arguments" help="Space-separated arguments"><Input value={form.args} onChange={v => updateForm({ args: v })} placeholder="/opt/services/order-mcp/index.js" mono /></HField>
            </>}
          </div>
          {testOk && <div className="mt-3 py-2.5 px-3 rounded-lg text-[12px] border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">Connected — {testOk.tools} tool{testOk.tools === 1 ? '' : 's'} discovered</div>}
          {testFail && <div className="mt-3 py-2.5 px-3 rounded-lg text-[12px] border text-red-400 bg-red-500/10 border-red-500/20">{testFail}</div>}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-sm text-[12px] font-medium transition-colors" style={css.secondary}>Cancel</button>
            <button onClick={test} disabled={isBusy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-[12px] font-medium disabled:opacity-50 transition-colors" style={css.secondary}>
              {flowState.status === 'testing' ? <><Loader2 size={12} className="animate-spin" /> Testing...</> : 'Test connection'}
            </button>
            <button onClick={() => save(workspaceId)} disabled={isBusy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-[12px] font-medium disabled:opacity-50 transition-colors hover:opacity-90" style={css.primary}>
              {flowState.status === 'saving' ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : 'Save connection'}
            </button>
          </div>
        </div>
      )}
    </div>
  </ErrorBoundary></Modal>);
}
