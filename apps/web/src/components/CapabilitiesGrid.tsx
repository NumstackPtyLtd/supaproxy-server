import { Plug, BookOpen, Shield, Activity, Lock, MessageSquare } from 'lucide-react';
import { CONSUMER_TYPES, CONSUMERS } from '../lib/registries/consumers';

const consumerLabels = CONSUMER_TYPES.map(t => CONSUMERS[t].label).join(', ');

const capabilities = [
  { title: 'Connections', desc: 'MCP servers, REST APIs, databases. Auto-discovered tools. Org-wide blocking for flagged connections.', icon: Plug },
  { title: 'Knowledge', desc: 'Wikis, docs, inline context. Per-workspace. Versioned and synced.', icon: BookOpen },
  { title: 'Compliance', desc: 'PII filtering, write confirmation, cost caps, rate limits. Org sets the floor.', icon: Shield },
  { title: 'Observability', desc: 'Every query logged. User, tools, tokens, cost, duration. Dashboards and export.', icon: Activity },
  { title: 'Isolation', desc: 'Each workspace is sealed. No cross-workspace data leaks.', icon: Lock },
  { title: 'Multi-channel', desc: `${consumerLabels}. Same workspace, same rules, different entry points.`, icon: MessageSquare },
];

export default function CapabilitiesGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {capabilities.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.title} className="rounded-xl p-5 hover:shadow-md hover:border-black/30 transition-all" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--bg-surface)' }}>
              <Icon size={18} className="text-heading" />
            </div>
            <div className="text-[14px] font-semibold text-heading mb-1.5">{c.title}</div>
            <div className="text-[12px] leading-relaxed" style={{ color: 'var(--body)' }}>{c.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
