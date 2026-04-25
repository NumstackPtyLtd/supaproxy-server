import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { Modal } from './shared/Modal';
import { HField, Input } from './shared/FormFields';
import { useAddConsumer } from '../hooks/useAddConsumer';
import { CONSUMER_TYPES, CONSUMERS, type ConsumerType } from '../lib/registries/consumers';

interface Props {
  workspaceId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddConsumerModal({ workspaceId, onClose, onSaved }: Props) {
  const [type, setType] = useState<ConsumerType | null>('slack');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const {
    slackEnabled,
    saveMutation,
    successMessage,
    errorMessage,
    clearError,
    saveSlackChannel,
  } = useAddConsumer(workspaceId, onSaved, onClose);

  const saving = saveMutation.status === 'submitting';
  const slackIsEnabled = slackEnabled.status === 'success' ? slackEnabled.data : null;
  const slackDisabled = type === 'slack' && slackIsEnabled === false;

  const activeMeta = type ? CONSUMERS[type] : null;

  const setField = (name: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (type === 'slack') {
      saveSlackChannel({
        channelId: fieldValues['channelId'] || '',
        channelName: fieldValues['channelName'] || '',
      });
    }
  };

  return (
    <Modal onClose={onClose} title="Add consumer">
      <ErrorBoundary>
        {/* Type tabs */}
        <div className="px-5 pt-4 pb-0">
          <div className="flex gap-2" role="tablist">
            {CONSUMER_TYPES.map(ct => {
              const meta = CONSUMERS[ct];
              const Icon = meta.icon;
              const disabled = !!meta.disabled || (ct === 'slack' && slackIsEnabled === false);
              const isActive = type === ct;
              return (
                <button key={ct} onClick={() => { if (!disabled) { setType(ct); setFieldValues({}); clearError(); } }}
                  role="tab"
                  aria-selected={isActive && !disabled}
                  tabIndex={isActive && !disabled ? 0 : -1}
                  className={`flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-sm border text-[11px] font-medium transition-colors ${
                    isActive && !disabled
                      ? 'border-heading text-heading'
                      : disabled
                        ? 'cursor-default'
                        : 'hover:border-heading hover:text-heading cursor-pointer'
                  }`}
                  style={
                    isActive && !disabled
                      ? { background: 'var(--bg-surface)', borderColor: 'var(--heading)' }
                      : disabled
                        ? { borderColor: 'var(--border-color)', color: 'var(--text-muted)', opacity: 0.4 }
                        : { borderColor: 'var(--border-color)', color: 'var(--text-muted)' }
                  }>
                  <Icon size={16} />
                  <span>{meta.label}</span>
                  {meta.disabled && <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>soon</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-5 text-[13px]">
          {errorMessage && <div className="mb-4 py-2 text-[12px] text-error border-l-2 border-error pl-3">{errorMessage}</div>}
          {successMessage && <div className="mb-4 py-2 text-[12px] text-success border-l-2 border-success pl-3">{successMessage}</div>}

          {type && activeMeta && (
            <div>
              {slackDisabled ? (
                <div className="flex items-start gap-2 p-3 rounded-lg" style={{ border: '1px solid var(--border-color)', background: 'color-mix(in srgb, var(--bg-surface) 50%, transparent)' }}>
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Slack bot not configured. Ask your admin to set it up in Organisation Settings &gt; Integrations.</p>
                </div>
              ) : (
                <>
                  <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
                    {activeMeta.description}
                  </p>
                  {activeMeta.fields && activeMeta.fields.length > 0 && (
                    <div className="rounded-lg" style={{ border: '1px solid var(--border-color)' }}>
                      {activeMeta.fields.map(field => (
                        <HField key={field.name} label={field.label} help={field.help}>
                          <Input
                            value={fieldValues[field.name] || ''}
                            onChange={v => setField(field.name, v)}
                            placeholder={field.placeholder}
                            mono={field.mono}
                          />
                        </HField>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose}
                      className="px-4 py-2 rounded-sm text-[12px] font-medium transition-colors"
                      style={{ color: 'var(--body)', border: '1px solid var(--border-color)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-[12px] font-medium disabled:opacity-50"
                      style={{ color: 'var(--btn-primary-text)', background: 'var(--btn-primary-bg)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}>
                      {saving ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : 'Save'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </ErrorBoundary>
    </Modal>
  );
}
