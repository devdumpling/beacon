/**
 * Feature flags module for the Beacon SDK.
 *
 * Flags are automatically synced from the server via WebSocket. When flags
 * change, all subscribers are notified.
 *
 * @module flags
 */

/** Internal store type for feature flags */
type FlagStore = Record<string, boolean>;

let flags: FlagStore = {};
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beacon:flags", ((e: CustomEvent<FlagStore>) => {
    flags = e.detail;
    listeners.forEach((fn) => fn());
  }) as EventListener);
}

/**
 * Check if a feature flag is enabled.
 *
 * @param key - The flag key to check
 * @param fallback - Value to return if the flag is not defined (default: false)
 * @returns Whether the flag is enabled
 *
 * @example
 * ```ts
 * import { flag } from "@beacon/sdk";
 *
 * if (flag("new_checkout_flow")) {
 *   // Show new checkout
 * } else {
 *   // Show legacy checkout
 * }
 *
 * // With fallback for undefined flags
 * const showBanner = flag("promo_banner", true);
 * ```
 */
export function isEnabled(key: string, fallback = false): boolean {
  return flags[key] ?? fallback;
}

/**
 * Subscribe to flag changes.
 *
 * The callback is invoked whenever flags are updated from the server.
 * Returns an unsubscribe function.
 *
 * @param fn - Callback to invoke when flags change
 * @returns Unsubscribe function
 *
 * @example
 * ```ts
 * import { flag, subscribe } from "@beacon/sdk";
 *
 * // React example
 * useEffect(() => {
 *   const unsubscribe = subscribe(() => {
 *     setShowFeature(flag("new_feature"));
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Get all current flag values.
 *
 * Returns a copy of the flag store. Useful for debugging or
 * passing flags to server-side rendering.
 *
 * @returns Object containing all flag key-value pairs
 *
 * @example
 * ```ts
 * console.log("Current flags:", getAll());
 * // { new_feature: true, dark_mode: false, ... }
 * ```
 */
export function getAll(): FlagStore {
  return { ...flags };
}
