import { useState, useEffect, useRef } from 'react';

const FILTER_LABELS: Record<string, string> = { status: 'Status', category: 'Category', resolution: 'Resolution', consumer: 'Channel' };

interface FilterDropdownProps {
  filters: Record<string, string[]>;
  active: Record<string, string>;
  onChange: (f: Record<string, string>) => void;
}

export default function FilterDropdown({ filters, active, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allOptions: Array<{ group: string; value: string }> = [];
  for (const [group, values] of Object.entries(filters)) {
    for (const v of values) {
      allOptions.push({ group, value: v });
    }
  }

  const filtered = search
    ? allOptions.filter(o => o.value.toLowerCase().includes(search.toLowerCase()) || (FILTER_LABELS[o.group] || o.group).toLowerCase().includes(search.toLowerCase()))
    : allOptions;

  const activeCount = Object.values(active).filter(v => v).length;

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen(!open); setSearch(''); }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors"
        style={{ border: '1px solid var(--border-color)', color: activeCount > 0 ? 'var(--text-heading)' : 'var(--text-muted)', background: 'var(--bg-card)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
        Filter{activeCount > 0 && ` (${activeCount})`}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[220px] rounded-lg shadow-2xl z-50 overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search filters..."
              autoFocus
              className="w-full px-3 py-2 text-[11px] focus:outline-none"
              style={{ background: 'transparent', color: 'var(--text-heading)' }}
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            {Object.entries(filters).map(([group]) => {
              const groupOptions = filtered.filter(o => o.group === group);
              if (groupOptions.length === 0) return null;
              return (
                <div key={group}>
                  <div className="px-3 py-1 text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {FILTER_LABELS[group] || group}
                  </div>
                  {groupOptions.map(o => {
                    const isActive = active[o.group] === o.value;
                    return (
                      <button key={`${o.group}-${o.value}`}
                        onClick={() => {
                          onChange({ ...active, [o.group]: isActive ? '' : o.value });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors capitalize"
                        style={{ color: isActive ? 'var(--text-heading)' : 'var(--body)' }}
                      >
                        <span className="w-3.5 h-3.5 rounded-sm flex items-center justify-center flex-shrink-0"
                          style={{ border: '1px solid var(--border-color)', background: isActive ? 'var(--text-heading)' : 'transparent' }}>
                          {isActive && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--bg-card)" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                        </span>
                        {o.value}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>No matching filters</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
