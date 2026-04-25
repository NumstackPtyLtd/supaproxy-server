import { createElement } from 'react';
import { HField, SecretInput } from '../shared/FormFields';
import { getConsumer } from '../../lib/registries/consumers';
import type { SettingsFormState } from '../../hooks/useOrgSettings';
import type { MutationState } from '../../types/state';

interface Props {
  settings: SettingsFormState;
  setSettings: React.Dispatch<React.SetStateAction<SettingsFormState>>;
  mutation: MutationState;
  onSaveSetting: (key: string, value: string) => void;
  onTestSlack: () => void;
}

export default function IntegrationsSection({ settings, setSettings, mutation, onSaveSetting, onTestSlack }: Props) {
  const saving = mutation.status === 'submitting';

  return (
    <div className="max-w-[640px]">
      <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>Integrations</h2>
      <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>Configure external services used by all workspaces.</p>

      {/* AI provider */}
      <div className="rounded-sm mb-4 overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14v-4m0-4h.01"/></svg>
            </div>
            <div>
              <h3 className="text-[12px] font-semibold" style={{ color: 'var(--text-heading)' }}>AI provider</h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Used by all workspaces. Supports any OpenAI-compatible AI provider.</p>
            </div>
          </div>
        </div>
        <HField label="API key" help="Your AI provider API key">
          <SecretInput value={settings.aiProviderKey} onChange={v => setSettings(prev => ({ ...prev, aiProviderKey: v }))} placeholder="sk-..." />
        </HField>
        <div className="flex items-center justify-end gap-3 px-4 py-2.5" style={{ borderTop: '1px solid var(--border-color)' }}>
          {mutation.status === 'success' && <span className="text-[11px] text-success">Saved</span>}
          {mutation.status === 'error' && <span className="text-[11px] text-error">{mutation.message}</span>}
          <button onClick={() => onSaveSetting('ai_api_key', settings.aiProviderKey)} disabled={saving}
            className="px-4 py-1.5 rounded-sm text-[11px] font-medium disabled:opacity-50 transition-colors hover:opacity-90"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Slack bot */}
      <div className="rounded-sm overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
              {createElement(getConsumer('slack').icon, { size: 12 })}
            </div>
            <div>
              <h3 className="text-[12px] font-semibold" style={{ color: 'var(--text-heading)' }}>{getConsumer('slack').label}</h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{getConsumer('slack').settingsLabel}</p>
            </div>
          </div>
        </div>
        <HField label="Bot token" help="OAuth token from your Slack app settings">
          <SecretInput value={settings.slackBotToken} onChange={v => setSettings(prev => ({ ...prev, slackBotToken: v }))} placeholder="Paste bot token" />
        </HField>
        <HField label="App token" help="Socket mode token with connections:write scope">
          <SecretInput value={settings.slackAppToken} onChange={v => setSettings(prev => ({ ...prev, slackAppToken: v }))} placeholder="Paste app token" />
        </HField>
        <div className="flex justify-end gap-2 px-4 py-2.5" style={{ borderTop: '1px solid var(--border-color)' }}>
          <button onClick={onTestSlack} disabled={saving || !settings.slackBotToken}
            className="px-4 py-1.5 rounded-sm text-[11px] font-medium disabled:opacity-50 transition-colors hover:opacity-90"
            style={{ color: 'var(--body)', border: '1px solid var(--border-color)' }}>
            Test
          </button>
          <button onClick={async () => { await onSaveSetting('slack_bot_token', settings.slackBotToken); await onSaveSetting('slack_app_token', settings.slackAppToken); }} disabled={saving}
            className="px-4 py-1.5 rounded-sm text-[11px] font-medium disabled:opacity-50 transition-colors hover:opacity-90"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
