import { useState, useEffect } from 'react';
import { Shield, Settings, Plug2, Users, Server } from 'lucide-react';
import { ErrorBoundary } from './shared/ErrorBoundary';
import Breadcrumbs from './Breadcrumbs';
import GeneralSection from './settings/GeneralSection';
import IntegrationsSection from './settings/IntegrationsSection';
import ComplianceSection from './settings/ComplianceSection';
import UsersSection from './settings/UsersSection';
import QueuesSection from './settings/QueuesSection';
import {
  useOrgSettings,
  type OrgData,
  type OrgUser,
} from '../hooks/useOrgSettings';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Section = 'general' | 'integrations' | 'compliance' | 'users' | 'queues';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getSettingsSectionFromUrl(): Section {
  if (typeof window === 'undefined') return 'general';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const valid: Section[] = ['general', 'integrations', 'compliance', 'users', 'queues'];
  return valid.includes(tab as Section) ? (tab as Section) : 'general';
}

const NAV_GROUPS = [
  {
    header: 'CONFIGURATION',
    items: [
      { id: 'general' as const, label: 'General', icon: Settings },
      { id: 'compliance' as const, label: 'Compliance', icon: Shield },
    ],
  },
  {
    header: 'INTEGRATIONS',
    items: [
      { id: 'integrations' as const, label: 'Integrations', icon: Plug2 },
    ],
  },
  {
    header: 'TEAM',
    items: [
      { id: 'users' as const, label: 'Users', icon: Users },
    ],
  },
  {
    header: 'SYSTEM',
    items: [
      { id: 'queues' as const, label: 'Queues', icon: Server },
    ],
  },
];

// ─── Main component ────────────────────────────────────────────────────────────

export default function OrgSettings() {
  const [section, setSectionState] = useState<Section>(getSettingsSectionFromUrl);
  const {
    fetchState,
    settings,
    setSettings,
    mutation,
    message,
    clearMessage,
    saveGeneral,
    saveSetting,
    testSlack,
  } = useOrgSettings();

  const setSection = (s: Section) => {
    setSectionState(s);
    clearMessage();
    const url = new URL(window.location.href);
    if (s === 'general') url.searchParams.delete('tab');
    else url.searchParams.set('tab', s);
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const onPop = () => setSectionState(getSettingsSectionFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (fetchState.status === 'loading') return <div className="text-[13px] py-8" style={{ color: 'var(--text-muted)' }}>Loading...</div>;
  if (fetchState.status === 'error') return <div className="text-[13px] py-8 text-error">Failed to load settings: {fetchState.error}</div>;

  const { org, users } = fetchState.status === 'success' ? fetchState.data : { org: null as OrgData | null, users: [] as OrgUser[] };

  return (
    <ErrorBoundary>
    <div className="text-[13px]">
      <div className="py-2">
        <Breadcrumbs items={[{ label: 'Settings' }]} />
      </div>
      <div className="flex" style={{ height: 'calc(100% - 36px)' }}>
      {/* Left sidebar */}
      <div className="w-44 flex-shrink-0 pr-3 py-3" style={{ borderRight: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2 mb-5 px-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
            {org?.name?.[0] || 'O'}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-heading)' }}>{org?.name || 'Organisation'}</div>
            <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>Settings</div>
          </div>
        </div>

        <nav className="space-y-4" role="navigation" aria-label="Settings">
          {NAV_GROUPS.map(group => (
            <div key={group.header}>
              <div className="px-2 mb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{group.header}</div>
              <div className="space-y-0.5">
                {group.items.map(n => {
                  const Icon = n.icon;
                  const isActive = section === n.id;
                  return (
                    <button key={n.id} onClick={() => setSection(n.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-[12px] transition-colors ${isActive ? 'font-medium' : 'hover:opacity-80'}`}
                      style={{
                        background: isActive ? 'var(--bg-hover)' : 'transparent',
                        color: isActive ? 'var(--text-heading)' : 'var(--body)',
                      }}>
                      <Icon size={14} style={{ color: isActive ? 'var(--text-heading)' : 'var(--text-muted)' }} />
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 pl-6 py-3 overflow-y-auto">
        {message && <div className={`mb-4 py-2 text-[12px] border-l-2 pl-3 ${message.includes('ailed') || message.includes('ould') ? 'text-error border-error' : 'text-success border-success'}`}>{message}</div>}

        {section === 'general' && <GeneralSection settings={settings} setSettings={setSettings} org={org} mutation={mutation} onSave={saveGeneral} />}
        {section === 'integrations' && <IntegrationsSection settings={settings} setSettings={setSettings} mutation={mutation} onSaveSetting={saveSetting} onTestSlack={testSlack} />}
        {section === 'compliance' && <ComplianceSection />}
        {section === 'users' && <UsersSection users={users} />}
        {section === 'queues' && <QueuesSection />}
      </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}
