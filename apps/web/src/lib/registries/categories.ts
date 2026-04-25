export const CATEGORY_TYPES = [
  "query",
  "issue",
  "sales",
  "feedback",
  "support",
  "internal",
  "other",
] as const;

export type ConversationCategory = (typeof CATEGORY_TYPES)[number];

interface CategoryMeta {
  label: string;
  classes: string;
}

export const CATEGORIES: Record<ConversationCategory, CategoryMeta> = {
  query: { label: "Query", classes: "bg-blue-500/15 text-blue-600" },
  issue: { label: "Issue", classes: "bg-red-500/15 text-red-600" },
  sales: { label: "Sales", classes: "bg-violet-500/15 text-violet-600" },
  feedback: { label: "Feedback", classes: "bg-amber-500/15 text-amber-600" },
  support: { label: "Support", classes: "bg-teal-500/15 text-teal-600" },
  internal: { label: "Internal", classes: "bg-slate-500/15 text-slate-600" },
  other: { label: "Other", classes: "bg-gray-500/15 text-gray-600" },
};

export function getCategory(category: string): CategoryMeta {
  if (category in CATEGORIES) {
    return CATEGORIES[category as ConversationCategory];
  }
  return { label: category, classes: "bg-gray-500/15 text-gray-600" };
}
