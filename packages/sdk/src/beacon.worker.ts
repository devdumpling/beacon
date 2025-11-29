interface Config {
  url: string;
  projectId: string;
}

interface QueuedMessage {
  type: string;
  event?: string;
  props?: Record<string, unknown>;
  ts?: number;
  userId?: string;
  traits?: Record<string, unknown>;
}

let ws: WebSocket | null = null;
let config: Config | null = null;
let anonId: string;
let sessionId: string;
let userId: string | null = null;
let queue: QueuedMessage[] = [];
let reconnectDelay = 1000;
let reconnectTimer: number | null = null;

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min
let lastActivity = Date.now();

function uuid(): string {
  return crypto.randomUUID();
}

function connect() {
  if (!config) return;

  const wsUrl = config.url.replace(/^http/, "ws");
  const params = new URLSearchParams({
    project: config.projectId,
    session: sessionId,
    anon: anonId,
  });

  ws = new WebSocket(`${wsUrl}/ws?${params}`);

  ws.onopen = () => {
    reconnectDelay = 1000;
    self.postMessage("ready");
    flush();
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "flags") {
        self.postMessage({ type: "flags", flags: msg.flags });
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = self.setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay);
}

function send(msg: QueuedMessage) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    queue.push(msg);
  }
}

function flush() {
  while (queue.length && ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(queue.shift()));
  }
}

function maybeRotateSession() {
  const now = Date.now();
  if (now - lastActivity > SESSION_TIMEOUT) {
    sessionId = uuid();
  }
  lastActivity = now;
}

self.onmessage = (e) => {
  const { t } = e.data;

  if (t === "init") {
    config = { url: e.data.url, projectId: e.data.projectId };
    anonId = uuid();
    sessionId = uuid();
    connect();
    return;
  }

  maybeRotateSession();

  if (t === "id") {
    userId = e.data.userId;
    send({
      type: "identify",
      userId: e.data.userId,
      traits: e.data.traits,
    });
    return;
  }

  if (t === "e") {
    send({
      type: "event",
      event: e.data.event,
      props: e.data.props,
      ts: e.data.ts,
    });
  }
};
