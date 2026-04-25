import { Shield } from 'lucide-react';
import { parseJSON } from '../../lib/utils';
import type { Guardrail, Violation } from './types';

interface WorkspaceComplianceProps {
  guardrails: Guardrail[];
  violations: Violation[];
  subTab: string;
  setSubTab: (v: string) => void;
  onSelectConvo: (id: string) => void;
}

export default function WorkspaceCompliance({ guardrails, violations, subTab, setSubTab, onSelectConvo }: WorkspaceComplianceProps) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-heading mb-1">Compliance</h2>
      <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>Guardrails, violations, and compliance monitoring.</p>
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-4" role="tablist">
        {[
          { id: 'default', label: `Violations (${violations.length})` },
          { id: 'rules', label: `Rules (${guardrails.filter(g => g.enabled).length})` },
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
      </div>

      {/* Violations view */}
      {subTab === 'default' && (
        violations.length > 0 ? (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            {violations.map((v, i) => (
              <button key={i} onClick={() => onSelectConvo(v.conversation_id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                style={i < violations.length - 1 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-heading">{v.rule}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{v.description}</div>
                </div>
                <div className="flex-shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>{v.user_name || ''}</div>
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg p-4 flex items-center gap-3" style={{ border: '1px solid var(--border-color)' }}>
            <Shield size={14} className="text-success flex-shrink-0" />
            <div>
              <div className="text-[12px] font-medium text-success">No violations detected</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>All conversations are compliant</div>
            </div>
          </div>
        )
      )}

      {/* Rules view */}
      {subTab === 'rules' && (
        guardrails.length === 0 ? (
          <div className="rounded-lg py-8 text-center" style={{ border: '1px solid var(--border-color)' }}>
            <Shield size={18} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No rules configured.</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            {guardrails.map((g, gi) => {
              const cfg = parseJSON(g.config);
              const configStr = Object.entries(cfg).map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as string[]).join(', ') || 'none' : v}`).join(' · ');
              return (
                <div key={g.id} className={`flex items-center gap-3 px-4 py-2.5 ${!g.enabled ? 'opacity-35' : ''}`}
                  style={gi < guardrails.length - 1 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
                  <div className={`w-1.5 h-1.5 rounded-full ${g.enabled ? 'bg-success' : ''}`}
                    style={!g.enabled ? { background: 'var(--border-color)' } : undefined} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] text-heading font-medium">{g.rule_type.replace(/_/g, ' ')}</div>
                    <div className="font-mono text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{configStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
