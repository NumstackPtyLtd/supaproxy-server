import { getConsumer } from '../../lib/registries/consumers';
import { getStatus } from '../../lib/registries/statuses';
import { getCategory } from '../../lib/registries/categories';

/* ── Formatting helpers ── */
export function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDateTime(d: string) {
  return `${fmtDate(d)} at ${fmtTime(d)}`;
}
export function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
export function fmtDurationSec(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

/* ── Channel icon (delegates to consumer registry) ── */
export function ChannelIcon({ type, size = 14, className = '' }: { type: string; size?: number; className?: string }) {
  const { icon: Icon } = getConsumer(type);
  return <Icon size={size} className={className} />;
}

/* ── User initial avatar ── */
export function UserAvatar({ name, size = 'sm' }: { name?: string; size?: 'sm' | 'md' }) {
  const initial = name?.[0]?.toUpperCase() || '?';
  const cls = size === 'md' ? 'w-7 h-7 text-[11px]' : 'w-5 h-5 text-[9px]';
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center font-medium text-white flex-shrink-0 border`}
      style={{ background: 'var(--bg-hover)', borderColor: 'var(--border-color)' }}
    >
      {initial}
    </div>
  );
}

/* ── Category badge ── */
export function CategoryBadge({ category }: { category: string }) {
  const { classes } = getCategory(category);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none ${classes}`}>
      {category}
    </span>
  );
}

/* ── Channel badge (icon + label) ── */
export function ChannelBadge({ type, size = 10 }: { type: string; size?: number }) {
  const { label, icon: Icon } = getConsumer(type);
  return (
    <span className="inline-flex items-center gap-1 text-heading font-medium">
      <Icon size={size} />
      {label}
    </span>
  );
}

/* ── Compact status pill ── */
export function StatusPill({ status }: { status: string }) {
  const { classes } = getStatus(status);
  return <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none ${classes}`}>{status}</span>;
}

/* ── Parse JSON safely (for tools_called, etc from DB) ── */
export function safeParseJSON<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}
