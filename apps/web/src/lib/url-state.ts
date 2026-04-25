import type { Section } from '../components/workspace/types';

const VALID_SECTIONS: Section[] = ['overview', 'connections', 'consumers', 'knowledge', 'compliance', 'observability', 'settings'];

export function getSectionFromUrl(): Section {
  if (typeof window === 'undefined') return 'overview';
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  return VALID_SECTIONS.includes(tab as Section) ? (tab as Section) : 'overview';
}

export function getSubTabFromUrl(): string {
  if (typeof window === 'undefined') return 'default';
  return new URLSearchParams(window.location.search).get('view') || 'default';
}

export function pushUrl(params: Record<string, string | null>) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === 'overview' || value === 'default') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.pushState({}, '', url.toString());
}
