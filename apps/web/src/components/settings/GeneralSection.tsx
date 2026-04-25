import { HField, Input } from '../shared/FormFields';
import type { OrgData, SettingsFormState } from '../../hooks/useOrgSettings';
import type { MutationState } from '../../types/state';

interface Props {
  settings: SettingsFormState;
  setSettings: React.Dispatch<React.SetStateAction<SettingsFormState>>;
  org: OrgData | null;
  mutation: MutationState;
  onSave: () => void;
}

export default function GeneralSection({ settings, setSettings, org, mutation, onSave }: Props) {
  const saving = mutation.status === 'submitting';

  return (
    <div className="max-w-[640px]">
      <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>General settings</h2>
      <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>Manage your organisation details.</p>
      <div className="rounded-lg" style={{ border: '1px solid var(--border-color)' }}>
        <HField label="Organisation name" help="Displayed throughout the dashboard.">
          <Input value={settings.orgName} onChange={v => setSettings(prev => ({ ...prev, orgName: v }))} placeholder="Acme Corp" />
        </HField>
        <HField label="Slug" help="URL-safe identifier. Cannot be changed.">
          <Input value={org?.slug || ''} onChange={() => {}} disabled mono />
        </HField>
        <HField label="Organisation ID" help="Unique system identifier.">
          <Input value={org?.id || ''} onChange={() => {}} disabled mono />
        </HField>
        <div className="flex justify-end px-5 py-3" style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
          <button onClick={onSave} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-[12px] font-medium disabled:opacity-50"
            style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
