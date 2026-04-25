export interface WorkspaceListItem {
  id: string;
  name: string;
  status?: string;
  team?: string;
  tool_count?: number;
  queries_today?: number;
  cost_mtd?: number | string;
  created_at?: string;
}
