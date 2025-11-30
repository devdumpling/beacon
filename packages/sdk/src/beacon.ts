/**
 * Properties that can be attached to events or user traits.
 * Supports strings, numbers, booleans, and null values.
 *
 * @example
 * ```ts
 * track("purchase", {
 *   product_id: "sku-123",
 *   price: 29.99,
 *   is_gift: false,
 *   coupon: null
 * });
 * ```
 */
export type EventProps = Record<string, string | number | boolean | null>;

/**
 * Connection state for the WebSocket connection to the Beacon server.
 *
 * - `connecting` - Initial connection attempt in progress
 * - `connected` - Successfully connected and ready to send events
 * - `disconnected` - Connection lost or closed
 * - `reconnecting` - Attempting to reconnect after a disconnect
 */
export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

/**
 * Configuration options for initializing the Beacon SDK.
 *
 * @example
 * ```ts
 * init({
 *   url: "https://beacon.example.com",
 *   apiKey: "bk_abc123...",
 *   onConnectionChange: (state) => console.log("Connection:", state),
 *   onError: (error) => console.error("Beacon error:", error)
 * });
 * ```
 */
export interface BeaconConfig {
  /** The Beacon server URL (e.g., "https://beacon.example.com") */
  url: string;
  /** Your project's API key */
  apiKey: string;
  /** Optional callback invoked when connection state changes */
  onConnectionChange?: (state: ConnectionState) => void;
  /** Optional callback invoked when an error occurs */
  onError?: (error: string) => void;
}

type WorkerMessage =
  | { t: "init"; url: string; apiKey: string }
  | { t: "e"; event: string; props?: EventProps; ts: number }
  | { t: "id"; userId: string; traits?: EventProps };

let worker: Worker | null = null;
let queue: WorkerMessage[] = [];
let ready = false;
let currentConnectionState: ConnectionState = "disconnected";
let connectionChangeCallback: ((state: ConnectionState) => void) | undefined;
let errorCallback: ((error: string) => void) | undefined;

function send(msg: WorkerMessage) {
  if (ready && worker) {
    worker.postMessage(msg);
  } else {
    queue.push(msg);
  }
}

/**
 * Initialize the Beacon SDK. Must be called before any other SDK methods.
 *
 * Creates a Web Worker for off-main-thread event processing and establishes
 * a WebSocket connection to the Beacon server.
 *
 * @param config - Configuration options including server URL and API key
 *
 * @example
 * ```ts
 * import { init, track, identify, page } from "@beacon/sdk";
 *
 * // Initialize on app startup
 * init({
 *   url: "https://beacon.example.com",
 *   apiKey: "bk_abc123..."
 * });
 *
 * // Now you can track events
 * track("app_loaded");
 * ```
 */
export function init(config: BeaconConfig): void {
  if (typeof window === "undefined") return;

  connectionChangeCallback = config.onConnectionChange;
  errorCallback = config.onError;

  worker = new Worker(new URL("./beacon.worker.js", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (e) => {
    if (e.data === "ready") {
      ready = true;
      queue.forEach((m) => worker!.postMessage(m));
      queue = [];
    }

    if (e.data?.type === "flags") {
      window.dispatchEvent(
        new CustomEvent("beacon:flags", { detail: e.data.flags }),
      );
    }

    if (e.data?.type === "connection") {
      currentConnectionState = e.data.state;
      connectionChangeCallback?.(e.data.state);
      window.dispatchEvent(
        new CustomEvent("beacon:connection", { detail: e.data.state }),
      );
    }

    if (e.data?.type === "error") {
      errorCallback?.(e.data.error);
      window.dispatchEvent(
        new CustomEvent("beacon:error", { detail: e.data.error }),
      );
    }
  };

  worker.postMessage({ t: "init", url: config.url, apiKey: config.apiKey });
}

/**
 * Get the current WebSocket connection state.
 *
 * @returns The current connection state
 *
 * @example
 * ```ts
 * if (getConnectionState() === "connected") {
 *   console.log("Ready to send events");
 * }
 * ```
 */
export function getConnectionState(): ConnectionState {
  return currentConnectionState;
}

/**
 * Track a custom event with optional properties.
 *
 * Events are queued and sent via WebSocket. If disconnected, events are
 * buffered and sent when the connection is re-established.
 *
 * @param event - Event name (e.g., "button_clicked", "purchase_completed")
 * @param props - Optional key-value properties to attach to the event
 *
 * @example
 * ```ts
 * // Simple event
 * track("signup_started");
 *
 * // Event with properties
 * track("item_added_to_cart", {
 *   product_id: "sku-456",
 *   quantity: 2,
 *   price: 19.99
 * });
 * ```
 */
export function track(event: string, props?: EventProps): void {
  send({ t: "e", event, props, ts: Date.now() });
}

/**
 * Identify the current user and associate them with their anonymous activity.
 *
 * Call this when a user logs in or when you know their identity. All subsequent
 * events will be associated with this user ID. User traits are stored and can
 * be used for segmentation.
 *
 * @param userId - Unique user identifier from your system
 * @param traits - Optional user properties (e.g., name, email, plan)
 *
 * @example
 * ```ts
 * // After user logs in
 * identify("user_12345", {
 *   email: "user@example.com",
 *   name: "Jane Doe",
 *   plan: "pro",
 *   created_at: "2024-01-15"
 * });
 * ```
 */
export function identify(userId: string, traits?: EventProps): void {
  send({ t: "id", userId, traits });
}

/**
 * Track a page view with automatic URL and referrer capture.
 *
 * Automatically captures the current URL, path, and referrer. Call this
 * on route changes in SPAs or on page load for traditional sites.
 *
 * The event is tracked as `$page` with the following automatic properties:
 * - `url`: Full URL (window.location.href)
 * - `path`: Path only (window.location.pathname)
 * - `ref`: Referrer (document.referrer)
 *
 * @param props - Optional additional properties to merge with automatic ones
 *
 * @example
 * ```ts
 * // Basic page view
 * page();
 *
 * // With additional context
 * page({
 *   section: "blog",
 *   author: "jane-doe"
 * });
 * ```
 */
export function page(props?: EventProps): void {
  if (typeof window === "undefined") return;

  track("$page", {
    url: window.location.href,
    path: window.location.pathname,
    ref: document.referrer,
    ...props,
  });
}

/**
 * Disconnect from the Beacon server and clean up resources.
 *
 * Terminates the Web Worker, closes the WebSocket connection, and resets
 * all internal state. Call this when unmounting your app or when you need
 * to reinitialize with different configuration.
 *
 * @example
 * ```ts
 * // In React useEffect cleanup
 * useEffect(() => {
 *   init({ url: "...", apiKey: "..." });
 *   return () => disconnect();
 * }, []);
 * ```
 */
export function disconnect(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  queue = [];
  ready = false;
  currentConnectionState = "disconnected";
  connectionChangeCallback?.("disconnected");
  connectionChangeCallback = undefined;
  errorCallback = undefined;
}
