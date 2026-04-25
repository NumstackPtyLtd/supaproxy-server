import { Building2, User, Briefcase, ChevronRight, Check, Loader2 } from 'lucide-react';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { Field, Input } from './shared/FormFields';
import { useSetup } from '../hooks/useSetup';

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < current ? 'bg-white' : i === current ? 'bg-white/40' : ''}`} style={i > current ? { background: 'var(--border-color)' } : undefined} />
      ))}
    </div>
  );
}

export default function SetupWizard() {
  const {
    step,
    form,
    setters,
    submitState,
    validationError,
    next,
    finish,
  } = useSetup();

  const saving = submitState.status === 'submitting';

  const STEPS = [
    { icon: Building2, label: 'Org' },
    { icon: User, label: 'Details' },
    { icon: Briefcase, label: 'Workspace' },
    { icon: Check, label: 'Done' },
  ];

  return (
    <ErrorBoundary>
    <div>
      <StepIndicator current={step} total={STEPS.length} />

      {/* Step labels */}
      <div className="flex justify-between mb-6 text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className={`flex items-center gap-1.5 transition-colors ${i < step ? 'text-heading/60' : ''} ${i === step ? 'text-heading font-medium' : ''}`}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: i <= step ? 'var(--border-color)' : 'var(--bg-surface)' }}>
                <Icon size={10} className={i <= step ? 'text-heading' : ''} style={i > step ? { color: 'var(--text-muted)' } : undefined} />
              </div>
              {s.label}
            </div>
          );
        })}
      </div>

      {validationError && <div className="mb-4 py-2.5 px-3 text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">{validationError}</div>}

      {/* Step 0: Organisation */}
      {step === 0 && (
        <div>
          <Field label="Organisation name">
            <Input value={form.orgName} onChange={setters.setOrgName} placeholder="Acme Corp" />
          </Field>
          <button onClick={next}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[12px] font-medium shadow-lg shadow-black/20 transition-colors"
            style={{ color: 'var(--btn-primary-text)', background: 'var(--btn-primary-bg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}>
            Continue <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Step 1: Account */}
      {step === 1 && (
        <div>
          <Field label="Your name">
            <Input value={form.adminName} onChange={setters.setAdminName} placeholder="Elvis Magagula" />
          </Field>
          <Field label="Email">
            <Input value={form.adminEmail} onChange={setters.setAdminEmail} placeholder="you@company.com" type="email" />
          </Field>
          <Field label="Password">
            <Input value={form.adminPassword} onChange={setters.setAdminPassword} placeholder="Min 8 characters" type="password" />
          </Field>
          <button onClick={next}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[12px] font-medium shadow-lg shadow-black/20 transition-colors"
            style={{ color: 'var(--btn-primary-text)', background: 'var(--btn-primary-bg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}>
            Continue <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Step 2: First workspace */}
      {step === 2 && (
        <div>
          <Field label="Workspace name">
            <Input value={form.wsName} onChange={setters.setWsName} placeholder="Support Bot" />
          </Field>
          <Field label="Team">
            <Input value={form.wsTeam} onChange={setters.setWsTeam} placeholder="Engineering" />
          </Field>
          <Field label="Model">
            <Input value={form.wsModel} onChange={setters.setWsModel} placeholder="gpt-4o" />
          </Field>
          <p className="text-[11px] mb-5" style={{ color: 'var(--text-muted)' }}>You can configure connections, knowledge, compliance, and prompts inside the workspace.</p>
          <button onClick={finish} disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[12px] font-medium shadow-lg shadow-black/20 disabled:opacity-50 transition-colors"
            style={{ color: 'var(--btn-primary-text)', background: 'var(--btn-primary-bg)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--btn-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--btn-primary-bg)')}>
            {saving ? <><Loader2 size={12} className="animate-spin" /> Creating...</> : <>Finish setup <Check size={12} /></>}
          </button>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="text-center py-8">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={26} className="text-black" />
          </div>
          <h2 className="text-lg font-semibold text-heading mb-2">You're all set!</h2>
          <p className="text-[13px]" style={{ color: 'var(--body)' }}>Taking you to {form.wsName}...</p>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
