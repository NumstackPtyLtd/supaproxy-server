export function parseJSON(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return {};
    }
  }
  return (v as Record<string, unknown>) || ({} as Record<string, unknown>);
}

/**
 * Theme colours for use in JS inline styles.
 * These match the @theme values in global.css.
 * Change here + global.css to rebrand.
 */
export const theme = {
  primary: '#F43F5E',
  primaryHover: '#E11D48',
  accent: '#FB7185',
  heading: '#1E293B',
  body: '#64748B',
  muted: '#94A3B8',
  border: '#E2E8F0',
  surface: '#F8FAFC',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

export function sentimentColour(score: number): string {
  const colors = ['', 'var(--sentiment-negative)', 'var(--sentiment-low)', 'var(--sentiment-neutral)', 'var(--sentiment-positive)', 'var(--sentiment-very-positive)'];
  return colors[score] || 'var(--sentiment-neutral)';
}

export const statusColour: Record<string, string> = {
  open: theme.primary,
  cold: theme.warning,
  closed: theme.muted,
};
