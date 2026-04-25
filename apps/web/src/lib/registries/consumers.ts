import { createElement, type ComponentType } from "react";
import { Code, Globe } from "lucide-react";

const SlackIcon: ComponentType<IconProps> = ({ className, size = 14 }) =>
  createElement(
    "svg",
    {
      className,
      viewBox: "0 0 24 24",
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      width: size,
      height: size,
    },
    createElement("path", {
      d: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z",
      fill: "#E01E5A",
    }),
    createElement("path", {
      d: "M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z",
      fill: "#36C5F0",
    }),
    createElement("path", {
      d: "M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z",
      fill: "#2EB67D",
    }),
    createElement("path", {
      d: "M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z",
      fill: "#ECB22E",
    })
  );

const WhatsAppIcon: ComponentType<IconProps> = ({ className, size = 14 }) =>
  createElement(
    "svg",
    {
      className,
      viewBox: "0 0 24 24",
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      width: size,
      height: size,
    },
    createElement("path", {
      d: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z",
      fill: "#25D366",
    }),
    createElement("path", {
      d: "M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.79 23.523l4.634-1.467A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-2.168 0-4.19-.585-5.932-1.604l-.425-.254-2.748.87.879-2.682-.278-.44A9.778 9.778 0 0 1 2.182 12c0-5.423 4.395-9.818 9.818-9.818S21.818 6.577 21.818 12s-4.395 9.818-9.818 9.818z",
      fill: "#25D366",
    })
  );

export const CONSUMER_TYPES = ["slack", "api", "whatsapp", "cli"] as const;

export type ConsumerType = (typeof CONSUMER_TYPES)[number];

export interface IconProps {
  className?: string;
  size?: number;
}

export interface ConsumerField {
  name: string;
  label: string;
  placeholder?: string;
  help?: string;
  type?: "text" | "password";
  mono?: boolean;
}

export interface ConsumerMeta {
  label: string;
  icon: ComponentType<IconProps>;
  description: string;
  settingsLabel?: string;
  fields?: ConsumerField[];
  placeholder?: string;
  disabled?: boolean;
}

export const CONSUMERS: Record<ConsumerType, ConsumerMeta> = {
  slack: {
    label: "Slack",
    icon: SlackIcon,
    description:
      "Bind a Slack channel to this workspace. When someone mentions the SupaProxy bot in this channel, queries will use this workspace's connections and knowledge.",
    settingsLabel: "Organisation-wide bot. Workspaces bind individual channels.",
    placeholder: "C0123456789",
    fields: [
      {
        name: "channelName",
        label: "Channel name",
        placeholder: "#support-channel",
        help: "The display name, e.g. #support-channel",
      },
      {
        name: "channelId",
        label: "Channel ID",
        placeholder: "C0EXAMPLE123",
        help: "Right-click the channel in Slack, View channel details, copy the ID at the bottom.",
        mono: true,
      },
    ],
  },
  api: {
    label: "API",
    icon: Code,
    description:
      "Generate an API key to send queries to this workspace programmatically.",
    disabled: true,
    fields: [
      {
        name: "apiKeyName",
        label: "Key name",
        placeholder: "my-api-key",
        help: "A label for this API key.",
      },
    ],
  },
  whatsapp: {
    label: "WhatsApp",
    icon: WhatsAppIcon,
    description:
      "Connect a WhatsApp number to this workspace for conversational AI.",
    disabled: true,
    fields: [
      {
        name: "phoneNumber",
        label: "Phone number",
        placeholder: "+1234567890",
        help: "The WhatsApp Business number to bind.",
      },
    ],
  },
  cli: {
    label: "CLI",
    icon: Code,
    description:
      "Use the CLI tool to interact with this workspace from your terminal.",
    disabled: true,
  },
};

export function getConsumer(type: string): ConsumerMeta {
  if (type in CONSUMERS) {
    return CONSUMERS[type as ConsumerType];
  }
  return { label: type, icon: Globe, description: "" };
}
