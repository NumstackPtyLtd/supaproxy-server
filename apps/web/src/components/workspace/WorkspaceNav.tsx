import { LayoutDashboard, Plug, BookOpen, Shield, Activity, Settings, MessageSquare, Zap } from 'lucide-react';
import type { Section } from './types';

const NAV_GROUPS = [
  {
    items: [
      { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    header: 'MANAGE',
    items: [
      { id: 'connections' as const, label: 'Connections', icon: Plug },
      { id: 'consumers' as const, label: 'Consumers', icon: MessageSquare },
      { id: 'knowledge' as const, label: 'Knowledge', icon: BookOpen },
      { id: 'compliance' as const, label: 'Compliance', icon: Shield },
    ],
  },
  {
    header: 'OBSERVE',
    items: [
      { id: 'observability' as const, label: 'Activity', icon: Activity },
    ],
  },
  {
    header: 'CONFIGURE',
    items: [
      { id: 'settings' as const, label: 'Settings', icon: Settings },
    ],
  },
];

interface Props {
  section: Section;
  onSectionChange: (s: Section) => void;
  onTestClick: () => void;
}

export default function WorkspaceNav({ section, onSectionChange, onTestClick }: Props) {
  return (
    <div className="w-44 flex-shrink-0 pr-3 py-3" style={{ borderRight: '1px solid var(--border-color)' }}>
      <div className="space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.header && (
              <div className="px-2 mb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{group.header}</div>
            )}
            <div className="space-y-0.5">
              {group.items.map(n => {
                const Icon = n.icon;
                const isActive = section === n.id;
                return (
                  <button key={n.id} onClick={() => onSectionChange(n.id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-[12px] transition-colors ${
                      isActive ? 'text-heading font-medium' : ''
                    }`}
                    style={isActive
                      ? { background: 'var(--nav-active-bg)' }
                      : { color: 'var(--body)' }}>
                    <Icon size={14} style={isActive ? undefined : { color: 'var(--text-muted)' }} />
                    {n.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom actions */}
      <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <button onClick={onTestClick}
          aria-label="Test workspace"
          className="w-full flex items-center gap-2 px-2 py-2 rounded-sm text-[12px] font-medium transition-colors"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
          <Zap size={14} />
          Test
        </button>
      </div>
    </div>
  );
}
