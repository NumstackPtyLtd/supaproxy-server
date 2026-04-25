import { Shield } from 'lucide-react';

export default function ComplianceSection() {
  return (
    <div className="max-w-[640px]">
      <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>Compliance</h2>
      <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>Organisation compliance rules are the baseline. Workspaces can add stricter rules but cannot weaken these.</p>
      <div className="rounded-lg" style={{ border: '1px solid var(--border-color)' }}>
        <div className="py-10 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--bg-surface)' }}>
            <Shield size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Compliance rules coming soon.</p>
        </div>
      </div>
    </div>
  );
}
