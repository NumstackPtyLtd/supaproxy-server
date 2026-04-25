import { AlertTriangle, HelpCircle } from 'lucide-react';
import type { ConversationStats, ComplianceViolation, KnowledgeGap, FraudIndicator } from '../../types/conversations';
import { safeParseJSON } from '../shared/ConversationUI';

export function ToolsSection({ stats }: { stats: ConversationStats | null }) {
  if (!stats?.tools_used) return null;
  const tools = safeParseJSON<string>(stats.tools_used);
  if (tools.length === 0) return null;

  return (
    <div className="pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
      <span className="block mb-1.5" style={{ color: 'var(--text-muted)' }}>Tools used</span>
      <div className="flex flex-wrap gap-1">
        {tools.map((t, i) => (
          <span key={i} className="text-2xs font-mono px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--bg-surface)', color: 'var(--body)', border: '1px solid var(--border-color)' }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export function FraudSection({ stats }: { stats: ConversationStats }) {
  const fraud = safeParseJSON<FraudIndicator>(stats.fraud_indicators);
  if (fraud.length === 0) return null;

  return (
    <div className="pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--border-color)' }}>
      <div className="flex items-center gap-1 mb-1">
        <AlertTriangle size={10} style={{ color: 'var(--color-danger)' }} />
        <span className="font-medium" style={{ color: 'var(--color-danger)' }}>{fraud.length} fraud indicator{fraud.length > 1 ? 's' : ''}</span>
      </div>
      {fraud.map((f, i) => (
        <div key={i} className="text-2xs pl-3.5">
          <span className="font-medium" style={{ color: f.severity === 'high' ? 'var(--color-danger)' : f.severity === 'medium' ? 'var(--color-warning)' : 'var(--color-info)' }}>{f.severity}</span>
          <span style={{ color: 'var(--body)' }}> {f.type}: {f.description}</span>
        </div>
      ))}
    </div>
  );
}

export function ViolationsGapsSection({ stats }: { stats: ConversationStats }) {
  const violations = safeParseJSON<ComplianceViolation>(stats.compliance_violations);
  const gaps = safeParseJSON<KnowledgeGap>(stats.knowledge_gaps);
  if (violations.length === 0 && gaps.length === 0) return null;

  return (
    <div className="pt-3 space-y-2" style={{ borderTop: '1px solid var(--border-color)' }}>
      {violations.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={10} style={{ color: 'var(--color-danger)' }} />
            <span className="font-medium" style={{ color: 'var(--color-danger)' }}>{violations.length} violation{violations.length > 1 ? 's' : ''}</span>
          </div>
          {violations.map((v, i) => (
            <div key={i} className="text-2xs pl-3.5" style={{ color: 'var(--body)' }}><span className="font-medium" style={{ color: 'var(--color-danger)' }}>{v.rule}</span>: {v.description}</div>
          ))}
        </div>
      )}
      {gaps.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1">
            <HelpCircle size={10} style={{ color: 'var(--color-warning)' }} />
            <span className="font-medium" style={{ color: 'var(--color-warning)' }}>{gaps.length} gap{gaps.length > 1 ? 's' : ''}</span>
          </div>
          {gaps.map((g, i) => (
            <div key={i} className="text-2xs pl-3.5" style={{ color: 'var(--body)' }}><span className="font-medium" style={{ color: 'var(--color-warning)' }}>{g.topic}</span>: {g.description}</div>
          ))}
        </div>
      )}
    </div>
  );
}
