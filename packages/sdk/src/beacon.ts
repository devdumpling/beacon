export type EventProps = Record<string, string | number | boolean | null>;

export interface BeaconConfig {
  url: string;
  projectId: string;
}

type WorkerMessage =
  | { t: "init"; url: string; projectId: string }
  | { t: "e"; event: string; props?: EventProps; ts: number }
  | { t: "id"; userId: string; traits?: EventProps };

let worker: Worker | null = null;
let queue: WorkerMessage[] = [];
let ready = false;

function send(msg: WorkerMessage) {
  if (ready && worker) {
    worker.postMessage(msg);
  } else {
    queue.push(msg);
  }
}

export function init(config: BeaconConfig): void {
  if (typeof window === "undefined") return;

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
  };

  worker.postMessage({ t: "init", url: config.url, projectId: config.projectId });
}

export function track(event: string, props?: EventProps): void {
  send({ t: "e", event, props, ts: Date.now() });
}

export function identify(userId: string, traits?: EventProps): void {
  send({ t: "id", userId, traits });
}

export function page(props?: EventProps): void {
  if (typeof window === "undefined") return;

  track("$page", {
    url: window.location.href,
    path: window.location.pathname,
    ref: document.referrer,
    ...props,
  });
}
