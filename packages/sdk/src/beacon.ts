export type EventProps = Record<string, string | number | boolean | null>;

export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

export interface BeaconConfig {
  url: string;
  projectId: string;
  /** Optional callback for connection state changes */
  onConnectionChange?: (state: ConnectionState) => void;
  /** Optional callback for errors */
  onError?: (error: string) => void;
}

type WorkerMessage =
  | { t: "init"; url: string; projectId: string }
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
 * Initialize the Beacon SDK
 * @param config - Configuration options
 */
export function init(config: BeaconConfig): void {
  if (typeof window === "undefined") return;

  connectionChangeCallback = config.onConnectionChange;
  errorCallback = config.onError;

  worker = new Worker(new URL("./beacon.worker.ts", import.meta.url), {
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
        new CustomEvent("beacon:flags", { detail: e.data.flags })
      );
    }

    if (e.data?.type === "connection") {
      currentConnectionState = e.data.state;
      connectionChangeCallback?.(e.data.state);
      window.dispatchEvent(
        new CustomEvent("beacon:connection", { detail: e.data.state })
      );
    }

    if (e.data?.type === "error") {
      errorCallback?.(e.data.error);
      window.dispatchEvent(
        new CustomEvent("beacon:error", { detail: e.data.error })
      );
    }
  };

  worker.postMessage({ t: "init", url: config.url, projectId: config.projectId });
}

/**
 * Get the current connection state
 */
export function getConnectionState(): ConnectionState {
  return currentConnectionState;
}

/**
 * Track a custom event
 * @param event - Event name
 * @param props - Optional event properties
 */
export function track(event: string, props?: EventProps): void {
  send({ t: "e", event, props, ts: Date.now() });
}

/**
 * Identify a user
 * @param userId - User identifier
 * @param traits - Optional user traits
 */
export function identify(userId: string, traits?: EventProps): void {
  send({ t: "id", userId, traits });
}

/**
 * Track a page view
 * @param props - Optional additional properties
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
