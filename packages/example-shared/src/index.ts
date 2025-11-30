export type LogType =
  | "event"
  | "identify"
  | "page"
  | "connection"
  | "flags"
  | "error"
  | "info";

export type LogDirection = "sent" | "received" | "system";

export interface LogEntry {
  id: string;
  type: LogType;
  message: string;
  direction: LogDirection;
  payload?: Record<string, unknown>;
  timestamp: Date;
}

export const LOG_ICONS: Record<LogType, string> = {
  event: "◆",
  identify: "●",
  page: "◇",
  connection: "◈",
  flags: "⚑",
  error: "✕",
  info: "○",
};

export function syntaxHighlight(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = "number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "key";
          match = match.slice(0, -1);
          return `<span class="${cls}">${match}</span>:`;
        } else {
          cls = "string";
        }
      } else if (/true|false/.test(match)) {
        cls = "boolean";
      } else if (/null/.test(match)) {
        cls = "null";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
