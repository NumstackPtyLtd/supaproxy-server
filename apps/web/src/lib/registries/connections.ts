import type { ComponentType } from "react";
import { Cpu, Globe } from "lucide-react";

export const CONNECTION_TYPES = ["mcp", "rest"] as const;

export type ConnectionType = (typeof CONNECTION_TYPES)[number];

interface ConnectionMeta {
  label: string;
  icon: ComponentType<{ className?: string }>;
  enabled: boolean;
}

export const CONNECTIONS: Record<ConnectionType, ConnectionMeta> = {
  mcp: { label: "MCP", icon: Cpu, enabled: true },
  rest: { label: "REST", icon: Globe, enabled: true },
};

export function getConnection(type: string): ConnectionMeta {
  if (type in CONNECTIONS) {
    return CONNECTIONS[type as ConnectionType];
  }
  return { label: type, icon: Globe, enabled: false };
}
