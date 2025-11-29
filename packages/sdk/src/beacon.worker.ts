interface Config {
  url: string;
  apiKey: string;
}

interface QueuedMessage {
  type: string;
  event?: string;
  props?: string; // JSON-stringified props for API
  ts?: number;
  userId?: string;
  traits?: string; // JSON-stringified traits for API
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

let ws: WebSocket | null = null;
let config: Config | null = null;
let anonId: string;
let sessionId: string;
let userId: string | null = null;
let queue: QueuedMessage[] = [];
let reconnectDelay = 1000;
let reconnectTimer: number | null = null;
let connectionState: ConnectionState = "disconnected";
let hasEverConnected = false;

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min
let lastActivity = Date.now();

function uuid(): string {
  return crypto.randomUUID();
}

function setConnectionState(state: ConnectionState) {
  connectionState = state;
  self.postMessage({ type: "connection", state });
}

function connect() {
  if (!config) return;

  setConnectionState(hasEverConnected ? "reconnecting" : "connecting");

  const wsUrl = config.url.replace(/^http/, "ws");
  const params = new URLSearchParams({
    key: config.apiKey,
    session: sessionId,
    anon: anonId,
  });

  ws = new WebSocket(`${wsUrl}/ws?${params}`);

  ws.onopen = () => {
    reconnectDelay = 1000;
    hasEverConnected = true;
    setConnectionState("connected");
    self.postMessage("ready");
    flush();
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "flags") {
        self.postMessage({ type: "flags", flags: msg.flags });
      }
    } catch (err) {
      // Log parse errors in debug mode
      if (process.env.NODE_ENV === "development") {
        console.warn("[beacon] Failed to parse message:", e.data, err);
      }
    }
  };

  ws.onclose = () => {
    setConnectionState("disconnected");
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    // On first connection failure, still signal "ready" so main thread doesn't wait forever
    // Events will queue and send when connection succeeds
    if (!hasEverConnected) {
      self.postMessage("ready");
      self.postMessage({
        type: "error",
        error: "Connection failed, will retry",
      });
    }
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
    config = { url: e.data.url, apiKey: e.data.apiKey };
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
      // API expects traits as a JSON string
      traits: JSON.stringify(e.data.traits || {}),
    });
    return;
  }

  if (t === "e") {
    send({
      type: "event",
      event: e.data.event,
      // API expects props as a JSON string
      props: JSON.stringify(e.data.props || {}),
      ts: e.data.ts,
    });
  }
};
