interface SetupBannerProps {
  aiConfigured: boolean;
}

export default function SetupBanner({ aiConfigured }: SetupBannerProps) {
  if (aiConfigured) return null;

  return (
    <div className="mb-3 flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div className="flex-1">
        <span className="text-xs text-amber-600 font-medium">No AI provider connected.</span>
        <span className="text-[11px] ml-1" style={{ color: 'var(--text-muted)' }}>The proxy needs an LLM to route queries to.</span>
      </div>
      <a href="/settings?tab=integrations" className="text-[11px] font-medium text-amber-600 hover:text-amber-300 transition-colors whitespace-nowrap">Go to Settings →</a>
    </div>
  );
}
