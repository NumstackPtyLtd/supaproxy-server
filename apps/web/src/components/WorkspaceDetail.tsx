import { useState, useEffect } from 'react';
import { ErrorBoundary } from './shared/ErrorBoundary';
import AddConnectionModal from './AddConnectionModal';
import AddConsumerModal from './AddConsumerModal';
import ConversationDetail from './ConversationDetail';
import Breadcrumbs from './Breadcrumbs';
import WorkspaceNav from './workspace/WorkspaceNav';
import WorkspaceOverview from './workspace/WorkspaceOverview';
import WorkspaceObservability from './workspace/WorkspaceObservability';
import WorkspaceConnections from './workspace/WorkspaceConnections';
import WorkspaceConsumers from './workspace/WorkspaceConsumers';
import WorkspaceKnowledge from './workspace/WorkspaceKnowledge';
import WorkspaceCompliance from './workspace/WorkspaceCompliance';
import WorkspaceSettings from './workspace/WorkspaceSettings';
import TestPlayground from './workspace/TestPlayground';
import SetupBanner from './workspace/SetupBanner';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import { getSectionFromUrl, getSubTabFromUrl, pushUrl } from '../lib/url-state';
import type { Section, DashboardData, Connection, Tool, Consumer, KnowledgeSource, WorkspaceKnowledgeGap, Guardrail, Violation, Conversation } from './workspace/types';

type ActiveModal = 'connection' | 'consumer' | 'test' | null;

export default function WorkspaceDetail({ workspaceId }: { workspaceId: string }) {
  const [section, setSectionState] = useState<Section>(getSectionFromUrl);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [activityLimit, setActivityLimit] = useState(20);
  const [subTab, setSubTabState] = useState<string>(getSubTabFromUrl);

  const setSubTab = (v: string) => {
    setSubTabState(v);
    pushUrl({ tab: section === 'overview' ? null : section, view: v === 'default' ? null : v });
  };

  const setSection = (s: Section) => {
    setSectionState(s);
    setSubTab('default');
    pushUrl({ tab: s === 'overview' ? null : s, view: null });
  };

  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => {
      setSectionState(getSectionFromUrl());
      setSubTabState(getSubTabFromUrl());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const {
    workspace,
    models,
    setupStatus,
    sectionState,
    availableFilters,
    refetchSection,
  } = useWorkspaceData(workspaceId, section, activityLimit, activeFilters);

  const availableModels = models.status === 'success' ? models.data : [];

  if (workspace.status === 'loading' || workspace.status === 'idle') {
    return <div className="text-[13px] py-8" style={{ color: 'var(--text-muted)' }}>Loading...</div>;
  }
  if (workspace.status === 'error') {
    return <div className="text-[13px] text-error py-8">Failed to load workspace</div>;
  }

  const ws = workspace.data;
  const sectionLoading = sectionState.status === 'loading' || sectionState.status === 'idle';
  const sectionData = sectionState.status === 'success' ? sectionState.data : null;
  const sectionLoadingEl = <div className="text-[12px] py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <ErrorBoundary resetKey={section}>
    <div className="text-[13px]">
      <div className="py-2">
        <Breadcrumbs items={[{ label: 'Workspaces', href: '/workspaces' }, { label: ws.name }]} />
      </div>

      {setupStatus && <SetupBanner aiConfigured={setupStatus.ai_configured} />}

      <div className="flex" style={{ height: 'calc(100% - 36px)' }}>
        <WorkspaceNav section={section} onSectionChange={setSection} onTestClick={() => setActiveModal('test')} />

        {/* Main content */}
        <div className="flex-1 min-w-0 pl-6 py-3 overflow-y-auto">

          {section === 'overview' && (
            (sectionLoading || !sectionData) ? sectionLoadingEl : (
              <WorkspaceOverview
                data={sectionData as DashboardData}
                setupStatus={setupStatus}
                setSection={setSection}
                openModal={setActiveModal}
                onSelectConvo={setSelectedConvo}
              />
            )
          )}

          {section === 'connections' && (
            (sectionLoading || !sectionData) ? sectionLoadingEl : (
              <WorkspaceConnections
                connections={(sectionData as { connections: Connection[]; tools: Tool[] }).connections || []}
                tools={(sectionData as { connections: Connection[]; tools: Tool[] }).tools || []}
                onAddConnection={() => setActiveModal('connection')}
                onRefetch={refetchSection}
              />
            )
          )}

          {section === 'consumers' && (
            (sectionLoading || !sectionData) ? sectionLoadingEl : (
              <WorkspaceConsumers
                consumers={(sectionData as { consumers: Consumer[] }).consumers || []}
                onAddConsumer={() => setActiveModal('consumer')}
              />
            )
          )}

          {section === 'knowledge' && (
            (sectionLoading || !sectionData) ? sectionLoadingEl : (
              <WorkspaceKnowledge
                knowledge={(sectionData as { knowledge: KnowledgeSource[]; gaps: WorkspaceKnowledgeGap[] }).knowledge || []}
                gaps={(sectionData as { knowledge: KnowledgeSource[]; gaps: WorkspaceKnowledgeGap[] }).gaps || []}
                subTab={subTab}
                setSubTab={setSubTab}
                onSelectConvo={setSelectedConvo}
              />
            )
          )}

          {section === 'compliance' && (
            (sectionLoading || !sectionData) ? sectionLoadingEl : (
              <WorkspaceCompliance
                guardrails={(sectionData as { guardrails: Guardrail[]; violations: Violation[] }).guardrails || []}
                violations={(sectionData as { guardrails: Guardrail[]; violations: Violation[] }).violations || []}
                subTab={subTab}
                setSubTab={setSubTab}
                onSelectConvo={setSelectedConvo}
              />
            )
          )}

          {section === 'observability' && (
            (sectionLoading || !sectionData) ? sectionLoadingEl : (
              <WorkspaceObservability
                data={sectionData as { conversations: Conversation[]; total: number; filters?: Record<string, string[]> }}
                activeFilters={activeFilters}
                availableFilters={availableFilters}
                activityLimit={activityLimit}
                onFilterChange={setActiveFilters}
                onLoadMore={() => setActivityLimit(prev => prev + 10)}
                onSelectConvo={setSelectedConvo}
              />
            )
          )}

          {section === 'settings' && (
            <WorkspaceSettings
              workspace={ws}
              workspaceId={workspaceId}
              availableModels={availableModels}
            />
          )}
        </div>

        {/* Test playground modal */}
        {activeModal === 'test' && (
          <TestPlayground
            workspaceId={workspaceId}
            workspaceName={ws.name}
            onClose={() => setActiveModal(null)}
          />
        )}

        {/* Conversation detail slide-over */}
        {selectedConvo && (
          <ConversationDetail
            workspaceId={workspaceId}
            conversationId={selectedConvo}
            onClose={() => setSelectedConvo(null)}
          />
        )}

        {activeModal === 'connection' && <AddConnectionModal workspaceId={workspaceId} onClose={() => setActiveModal(null)} onSaved={refetchSection} />}
        {activeModal === 'consumer' && <AddConsumerModal workspaceId={workspaceId} onClose={() => setActiveModal(null)} onSaved={refetchSection} />}
      </div>
    </div>
    </ErrorBoundary>
  );
}
