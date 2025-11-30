import { vi, beforeEach } from "vitest";

// Store original URL for restoration
const OriginalURL = globalThis.URL;

// Mock URL to handle import.meta.url in tests
class MockURL extends OriginalURL {
  constructor(url: string | URL, base?: string | URL) {
    // Handle cases where base is import.meta.url (an object in tests)
    if (base && typeof base === "object" && !(base instanceof URL)) {
      base = "http://localhost/test/";
    }
    super(url, base);
  }
}

vi.stubGlobal("URL", MockURL);

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  private messageHandler: ((data: unknown) => void) | null = null;
  terminated = false;

  constructor(_url: string | URL, _options?: WorkerOptions) {
    // Store reference for tests
    (globalThis as Record<string, unknown>).__mockWorker = this;
  }

  postMessage(data: unknown) {
    // Allow tests to inspect posted messages
    if (this.messageHandler) {
      this.messageHandler(data);
    }
  }

  // Test helper to simulate messages from worker
  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data }));
    }
  }

  // Test helper to set message handler
  setMessageHandler(handler: (data: unknown) => void) {
    this.messageHandler = handler;
  }

  terminate() {
    this.terminated = true;
  }
}

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  private sentMessages: string[] = [];

  constructor(_url: string) {
    // Store reference for tests
    (globalThis as Record<string, unknown>).__mockWebSocket = this;
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(
        new MessageEvent("message", { data: JSON.stringify(data) }),
      );
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  getSentMessages(): unknown[] {
    return this.sentMessages.map((m) => JSON.parse(m));
  }

  clearSentMessages() {
    this.sentMessages = [];
  }
}

// Install mocks
vi.stubGlobal("Worker", MockWorker);
vi.stubGlobal("WebSocket", MockWebSocket);

// Helper to get mock instances
export function getMockWorker(): MockWorker | null {
  return (globalThis as Record<string, unknown>).__mockWorker as MockWorker;
}

export function getMockWebSocket(): MockWebSocket | null {
  return (globalThis as Record<string, unknown>)
    .__mockWebSocket as MockWebSocket;
}

// Reset mocks between tests
beforeEach(() => {
  (globalThis as Record<string, unknown>).__mockWorker = null;
  (globalThis as Record<string, unknown>).__mockWebSocket = null;
});
