import type { SetupStatus, Section } from './types';
import { CONSUMER_TYPES, CONSUMERS } from '../../lib/registries/consumers';

type ActiveModal = 'connection' | 'consumer' | 'test' | null;

interface SetupChecklistProps {
  setupStatus: SetupStatus;
  setSection: (s: Section) => void;
  openModal: (modal: ActiveModal) => void;
}

export default function SetupChecklist({ setupStatus, setSection, openModal }: SetupChecklistProps) {
  const hasConnections = setupStatus.connections > 0;
  const hasAi = setupStatus.ai_configured;

  const consumerLabels = CONSUMER_TYPES.map(t => CONSUMERS[t].label).join(', ');

  const steps = [
    { done: !!hasAi, label: 'Connect an AI provider', desc: 'Add your LLM API key — this is what the proxy routes to', action: () => { window.location.href = '/settings?tab=integrations'; } },
    { done: !!hasConnections, label: 'Add a data source', desc: 'Connect an MCP server so the AI has tools to work with', action: () => { setSection('connections'); openModal('connection'); } },
    { done: false, label: 'Add a consumer', desc: `Route this proxy to ${consumerLabels}`, action: () => { setSection('consumers'); openModal('consumer'); } },
  ];

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-heading mb-1">Overview</h2>
      <p className="text-[12px] mb-6" style={{ color: 'var(--text-muted)' }}>Set up this proxy so your team can start querying.</p>
      <div className="rounded-sm" style={{ border: '1px solid var(--border-color)' }}>
        {steps.map((step, i) => (
          <button key={i} onClick={step.action}
            className="w-full flex items-center gap-3 py-3 px-4 text-[12px] text-heading transition-colors"
            style={i < steps.length - 1 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
            {step.done ? (
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
              </span>
            ) : (
              <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ border: '2px solid var(--border-light)' }} />
            )}
            <div className="text-left">
              <div className={`font-medium ${step.done ? 'line-through' : ''}`} style={step.done ? { color: 'var(--text-muted)' } : undefined}>{step.label}</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{step.desc}</div>
            </div>
            {!step.done && <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>→</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
