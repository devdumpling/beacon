/**
 * Shared formatting utilities for the dashboard.
 */

/**
 * Format a Unix timestamp to a locale-specific date/time string.
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

/**
 * Format a properties object as pretty-printed JSON.
 * Accepts Zero's ReadonlyJSONValue type (string, number, boolean, null, array, or object).
 */
export function formatProperties(props: unknown): string {
  if (props === null || props === undefined) return "{}";
  try {
    return JSON.stringify(props, null, 2);
  } catch {
    return String(props);
  }
}

/**
 * Format a timestamp as a relative time string (e.g., "5m ago", "2h ago").
 */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
