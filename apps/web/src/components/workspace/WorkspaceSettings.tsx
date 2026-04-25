import { HField, Input, Textarea } from '../shared/FormFields';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import type { Workspace, ModelOption } from './types';

interface WorkspaceSettingsProps {
  workspace: Workspace;
  workspaceId: string;
  availableModels: ModelOption[];
}

export default function WorkspaceSettings({ workspace, workspaceId, availableModels }: WorkspaceSettingsProps) {
  const { form, setters, saveState, message, saveSettings } = useWorkspaceSettings(workspace, workspaceId);

  const isSaving = saveState.status === 'submitting';

  return (
    <div className="max-w-[640px]">
      <h2 className="text-[15px] font-semibold text-heading mb-1">Workspace Settings</h2>
      <p className="text-[12px] mb-6" style={{ color: 'var(--text-muted)' }}>Configuration, model, and lifecycle settings.</p>

      {/* General */}
      <h3 className="text-[13px] font-semibold text-heading mb-3">General</h3>
      <div className="rounded-lg mb-6" style={{ border: '1px solid var(--border-color)' }}>
        <HField label="Workspace name" help="Displayed in the sidebar and breadcrumbs.">
          <Input value={form.name} onChange={setters.setName} placeholder="Support Bot" />
        </HField>
        <HField label="Model" help="The AI model tier used for queries.">
          <select value={form.model} onChange={(e) => setters.setModel(e.target.value)}
            className="w-full px-3 py-2 rounded-sm text-[13px] text-heading focus:outline-none focus:ring-2 focus:ring-white/20"
            style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.label}{m.default ? ' (default)' : ''}</option>
            ))}
          </select>
        </HField>
        <HField label="System prompt" help="Instructions that guide the AI's behaviour.">
          <Textarea value={form.prompt} onChange={setters.setPrompt} placeholder="You are a helpful AI..." rows={4} />
        </HField>
        <div className="flex items-center justify-end px-5 py-3" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
          {message && <span className={`mr-3 text-[12px] ${message === 'Saved.' ? 'text-success' : 'text-error'}`}>{message}</span>}
          <button onClick={saveSettings} disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-[12px] font-medium disabled:opacity-50 transition-colors"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Conversation lifecycle */}
      <h3 className="text-[13px] font-semibold text-heading mb-3">Conversation lifecycle</h3>
      <div className="rounded-lg mb-6" style={{ border: '1px solid var(--border-color)' }}>
        <HField label="Inactive timeout" help="Minutes before a quiet conversation goes cold.">
          <input type="number" value={form.coldTimeout} onChange={(e) => setters.setColdTimeout(parseInt(e.target.value) || 30)} min={1}
            className="w-full px-3 py-2 rounded-sm text-[13px] text-heading focus:outline-none focus:ring-2 focus:ring-white/20"
            style={{ border: '1px solid var(--border-color)' }} />
        </HField>
        <HField label="Close timeout" help="Minutes after cold before auto-close and stats.">
          <input type="number" value={form.closeTimeout} onChange={(e) => setters.setCloseTimeout(parseInt(e.target.value) || 60)} min={1}
            className="w-full px-3 py-2 rounded-sm text-[13px] text-heading focus:outline-none focus:ring-2 focus:ring-white/20"
            style={{ border: '1px solid var(--border-color)' }} />
        </HField>
      </div>

      {/* Reference */}
      <h3 className="text-[13px] font-semibold text-heading mb-3">Reference</h3>
      <div className="rounded-lg" style={{ border: '1px solid var(--border-color)' }}>
        <HField label="Workspace ID" help="Used in API calls and URLs.">
          <Input value={workspaceId} onChange={() => {}} disabled mono />
        </HField>
        <HField label="Team" help="The team this workspace belongs to.">
          <Input value={workspace.team || ''} onChange={() => {}} disabled />
        </HField>
      </div>
    </div>
  );
}
