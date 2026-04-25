export const STATUS_TYPES = [
  "open",
  "cold",
  "closed",
  "resolved",
  "escalated",
  "abandoned",
  "unresolved",
] as const;

export type ConversationStatus = (typeof STATUS_TYPES)[number];

interface StatusMeta {
  label: string;
  classes: string;
}

export const STATUSES: Record<ConversationStatus, StatusMeta> = {
  open: { label: "Open", classes: "bg-blue-500/15 text-blue-600" },
  cold: { label: "Cold", classes: "bg-slate-500/15 text-slate-600" },
  closed: { label: "Closed", classes: "bg-gray-500/15 text-gray-600" },
  resolved: { label: "Resolved", classes: "bg-emerald-500/15 text-emerald-600" },
  escalated: { label: "Escalated", classes: "bg-red-500/15 text-red-600" },
  abandoned: { label: "Abandoned", classes: "bg-amber-500/15 text-amber-600" },
  unresolved: { label: "Unresolved", classes: "bg-orange-500/15 text-orange-600" },
};

export function getStatus(status: string): StatusMeta {
  if (status in STATUSES) {
    return STATUSES[status as ConversationStatus];
  }
  return { label: status, classes: "bg-gray-500/15 text-gray-600" };
}
