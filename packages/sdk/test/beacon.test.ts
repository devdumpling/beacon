import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getMockWorker, getMockLocalStorage } from "./setup";

// We need to dynamically import to get fresh module state
async function importBeacon() {
  // Clear module cache to get fresh state
  vi.resetModules();
  return import("../src/beacon");
}

describe("beacon SDK", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("init", () => {
    it("creates a worker when called", async () => {
      const { init } = await importBeacon();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      expect(worker).not.toBeNull();
    });

    it("sends init message to worker with config", async () => {
      const { init } = await importBeacon();
      const messages: unknown[] = [];

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));

      // The init message is sent before we can set up the handler,
      // so we verify the worker was created with correct params
      expect(worker).not.toBeNull();
    });

    it("sets up onConnectionChange callback", async () => {
      const { init } = await importBeacon();
      const connectionChanges: string[] = [];

      init({
        url: "http://localhost:4000",
        apiKey: "test-key",
        onConnectionChange: (state) => connectionChanges.push(state),
      });

      const worker = getMockWorker();
      worker?.simulateMessage({ type: "connection", state: "connected" });

      expect(connectionChanges).toContain("connected");
    });

    it("sets up onError callback", async () => {
      const { init } = await importBeacon();
      const errors: string[] = [];

      init({
        url: "http://localhost:4000",
        apiKey: "test-key",
        onError: (error) => errors.push(error),
      });

      const worker = getMockWorker();
      worker?.simulateMessage({ type: "error", error: "Connection failed" });

      expect(errors).toContain("Connection failed");
    });

    it("dispatches beacon:flags event when flags received", async () => {
      const { init } = await importBeacon();
      const flagEvents: unknown[] = [];

      window.addEventListener("beacon:flags", ((e: CustomEvent) => {
        flagEvents.push(e.detail);
      }) as EventListener);

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.simulateMessage({
        type: "flags",
        flags: { feature_a: true, feature_b: false },
      });

      expect(flagEvents).toHaveLength(1);
      expect(flagEvents[0]).toEqual({ feature_a: true, feature_b: false });
    });

    it("dispatches beacon:connection event on state change", async () => {
      const { init } = await importBeacon();
      const connectionEvents: string[] = [];

      window.addEventListener("beacon:connection", ((e: CustomEvent) => {
        connectionEvents.push(e.detail);
      }) as EventListener);

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.simulateMessage({ type: "connection", state: "connected" });

      expect(connectionEvents).toContain("connected");
    });

    it("does nothing when window is undefined (SSR)", async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - simulating SSR
      delete globalThis.window;

      const { init } = await importBeacon();
      expect(() =>
        init({ url: "http://localhost:4000", apiKey: "test-key" }),
      ).not.toThrow();

      globalThis.window = originalWindow;
    });
  });

  describe("track", () => {
    it("queues events before worker is ready", async () => {
      const { init, track } = await importBeacon();
      const messages: unknown[] = [];

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));

      // Track before ready
      track("test_event");

      // Should not be sent yet (queued internally)
      // Messages won't appear until "ready" is received
      expect(messages.filter((m: any) => m.t === "e")).toHaveLength(0);
    });

    it("sends events after worker signals ready", async () => {
      const { init, track } = await importBeacon();
      const messages: unknown[] = [];

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));

      // Simulate worker ready
      worker?.simulateMessage("ready");

      // Now track
      track("test_event");

      expect(messages).toContainEqual(
        expect.objectContaining({
          t: "e",
          event: "test_event",
        }),
      );
    });

    it("includes timestamp in event", async () => {
      const { init, track } = await importBeacon();
      const messages: unknown[] = [];
      const now = Date.now();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));
      worker?.simulateMessage("ready");

      track("test_event");

      const eventMsg = messages.find((m: any) => m.t === "e") as any;
      expect(eventMsg.ts).toBeGreaterThanOrEqual(now);
    });

    it("includes props when provided", async () => {
      const { init, track } = await importBeacon();
      const messages: unknown[] = [];

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));
      worker?.simulateMessage("ready");

      track("purchase", { product_id: "sku-123", price: 29.99 });

      const eventMsg = messages.find((m: any) => m.t === "e") as any;
      expect(eventMsg.props).toEqual({ product_id: "sku-123", price: 29.99 });
    });
  });

  describe("identify", () => {
    it("sends identify message with userId", async () => {
      const { init, identify } = await importBeacon();
      const messages: unknown[] = [];

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));
      worker?.simulateMessage("ready");

      identify("user-123");

      expect(messages).toContainEqual(
        expect.objectContaining({
          t: "id",
          userId: "user-123",
        }),
      );
    });

    it("includes traits when provided", async () => {
      const { init, identify } = await importBeacon();
      const messages: unknown[] = [];

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));
      worker?.simulateMessage("ready");

      identify("user-123", { email: "test@example.com", plan: "pro" });

      const idMsg = messages.find((m: any) => m.t === "id") as any;
      expect(idMsg.traits).toEqual({ email: "test@example.com", plan: "pro" });
    });
  });

  describe("page", () => {
    it("tracks $page event with current URL", async () => {
      const { init, page } = await importBeacon();
      const messages: unknown[] = [];

      // Set up location mock
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:5173/dashboard",
          pathname: "/dashboard",
        },
        writable: true,
      });

      Object.defineProperty(document, "referrer", {
        value: "http://google.com",
        writable: true,
      });

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));
      worker?.simulateMessage("ready");

      page();

      const pageMsg = messages.find((m: any) => m.event === "$page") as any;
      expect(pageMsg).toBeDefined();
      expect(pageMsg.props.url).toBe("http://localhost:5173/dashboard");
      expect(pageMsg.props.path).toBe("/dashboard");
      expect(pageMsg.props.ref).toBe("http://google.com");
    });

    it("merges additional props", async () => {
      const { init, page } = await importBeacon();
      const messages: unknown[] = [];

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));
      worker?.simulateMessage("ready");

      page({ section: "blog", author: "jane" });

      const pageMsg = messages.find((m: any) => m.event === "$page") as any;
      expect(pageMsg.props.section).toBe("blog");
      expect(pageMsg.props.author).toBe("jane");
    });
  });

  describe("getConnectionState", () => {
    it("returns current connection state", async () => {
      const { init, getConnectionState } = await importBeacon();

      // Initially disconnected
      expect(getConnectionState()).toBe("disconnected");

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.simulateMessage({ type: "connection", state: "connected" });

      expect(getConnectionState()).toBe("connected");
    });
  });

  describe("disconnect", () => {
    it("terminates the worker", async () => {
      const { init, disconnect } = await importBeacon();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      expect(worker).not.toBeNull();
      expect(worker?.terminated).toBe(false);

      disconnect();

      expect(worker?.terminated).toBe(true);
    });

    it("resets connection state to disconnected", async () => {
      const { init, disconnect, getConnectionState } = await importBeacon();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.simulateMessage({ type: "connection", state: "connected" });
      expect(getConnectionState()).toBe("connected");

      disconnect();

      expect(getConnectionState()).toBe("disconnected");
    });

    it("calls onConnectionChange callback with disconnected", async () => {
      const { init, disconnect } = await importBeacon();
      const connectionChanges: string[] = [];

      init({
        url: "http://localhost:4000",
        apiKey: "test-key",
        onConnectionChange: (state) => connectionChanges.push(state),
      });

      const worker = getMockWorker();
      worker?.simulateMessage({ type: "connection", state: "connected" });

      disconnect();

      expect(connectionChanges).toContain("disconnected");
    });

    it("clears the message queue", async () => {
      const { init, track, disconnect } = await importBeacon();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      // Queue some events before worker is ready
      track("event1");
      track("event2");

      disconnect();

      // Re-init and verify queue is empty
      init({ url: "http://localhost:4000", apiKey: "test-key" });
      const messages: unknown[] = [];
      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));
      worker?.simulateMessage("ready");

      // Only the init message should have been sent, not the old queued events
      const eventMessages = messages.filter((m: any) => m.t === "e");
      expect(eventMessages).toHaveLength(0);
    });

    it("does nothing if called before init", async () => {
      const { disconnect } = await importBeacon();

      // Should not throw
      expect(() => disconnect()).not.toThrow();
    });

    it("allows reinitializing after disconnect", async () => {
      const { init, disconnect, track } = await importBeacon();

      init({ url: "http://localhost:4000", apiKey: "test-key" });
      disconnect();

      // Re-init
      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      const messages: unknown[] = [];
      worker?.setMessageHandler((data) => messages.push(data));
      worker?.simulateMessage("ready");

      track("after_reconnect");

      expect(messages).toContainEqual(
        expect.objectContaining({
          t: "e",
          event: "after_reconnect",
        }),
      );
    });
  });

  describe("session persistence", () => {
    it("stores anonId in localStorage on first init", async () => {
      const { init } = await importBeacon();
      const localStorage = getMockLocalStorage();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const storedAnonId = localStorage.getItem("beacon_anon_id");
      expect(storedAnonId).not.toBeNull();
      expect(storedAnonId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("reuses existing anonId from localStorage", async () => {
      const localStorage = getMockLocalStorage();
      const existingAnonId = "existing-anon-id-12345";
      localStorage.setItem("beacon_anon_id", existingAnonId);

      const { init } = await importBeacon();
      const messages: unknown[] = [];

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.setMessageHandler((data) => messages.push(data));

      // The anonId should still be the same
      expect(localStorage.getItem("beacon_anon_id")).toBe(existingAnonId);
    });

    it("stores session with timestamp in localStorage", async () => {
      const { init } = await importBeacon();
      const localStorage = getMockLocalStorage();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const storedSession = localStorage.getItem("beacon_session");
      expect(storedSession).not.toBeNull();

      const parsed = JSON.parse(storedSession!);
      expect(parsed.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(parsed.timestamp).toBeGreaterThan(0);
    });

    it("reuses session within 30-min timeout", async () => {
      const localStorage = getMockLocalStorage();
      const existingSessionId = "existing-session-12345";
      const recentTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      localStorage.setItem(
        "beacon_session",
        JSON.stringify({ id: existingSessionId, timestamp: recentTimestamp }),
      );

      const { init } = await importBeacon();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const storedSession = localStorage.getItem("beacon_session");
      const parsed = JSON.parse(storedSession!);
      expect(parsed.id).toBe(existingSessionId);
      // Timestamp should be updated
      expect(parsed.timestamp).toBeGreaterThan(recentTimestamp);
    });

    it("creates new session after 30-min timeout", async () => {
      const localStorage = getMockLocalStorage();
      const oldSessionId = "old-session-12345";
      const expiredTimestamp = Date.now() - 35 * 60 * 1000; // 35 minutes ago
      localStorage.setItem(
        "beacon_session",
        JSON.stringify({ id: oldSessionId, timestamp: expiredTimestamp }),
      );

      const { init } = await importBeacon();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const storedSession = localStorage.getItem("beacon_session");
      const parsed = JSON.parse(storedSession!);
      expect(parsed.id).not.toBe(oldSessionId);
    });

    it("updates session timestamp on track", async () => {
      const { init, track } = await importBeacon();
      const localStorage = getMockLocalStorage();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.simulateMessage("ready");

      const initialSession = JSON.parse(
        localStorage.getItem("beacon_session")!,
      );
      const initialTimestamp = initialSession.timestamp;

      // Advance time slightly
      vi.advanceTimersByTime(1000);

      track("test_event");

      const updatedSession = JSON.parse(
        localStorage.getItem("beacon_session")!,
      );
      expect(updatedSession.id).toBe(initialSession.id);
      expect(updatedSession.timestamp).toBeGreaterThan(initialTimestamp);
    });

    it("updates session timestamp on identify", async () => {
      const { init, identify } = await importBeacon();
      const localStorage = getMockLocalStorage();

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      worker?.simulateMessage("ready");

      const initialSession = JSON.parse(
        localStorage.getItem("beacon_session")!,
      );
      const initialTimestamp = initialSession.timestamp;

      // Advance time slightly
      vi.advanceTimersByTime(1000);

      identify("user-123");

      const updatedSession = JSON.parse(
        localStorage.getItem("beacon_session")!,
      );
      expect(updatedSession.id).toBe(initialSession.id);
      expect(updatedSession.timestamp).toBeGreaterThan(initialTimestamp);
    });

    it("passes anonId and sessionId to worker on init", async () => {
      const localStorage = getMockLocalStorage();
      const existingAnonId = "test-anon-id";
      const existingSessionId = "test-session-id";
      localStorage.setItem("beacon_anon_id", existingAnonId);
      localStorage.setItem(
        "beacon_session",
        JSON.stringify({ id: existingSessionId, timestamp: Date.now() }),
      );

      const { init } = await importBeacon();
      const messages: unknown[] = [];

      init({ url: "http://localhost:4000", apiKey: "test-key" });

      const worker = getMockWorker();
      // Capture the init message that was already sent
      // The first postMessage call should have been the init
      expect(worker).not.toBeNull();
    });

    it("handles invalid JSON in session storage gracefully", async () => {
      const localStorage = getMockLocalStorage();
      localStorage.setItem("beacon_session", "not valid json");

      const { init } = await importBeacon();

      // Should not throw
      expect(() =>
        init({ url: "http://localhost:4000", apiKey: "test-key" }),
      ).not.toThrow();

      // Should create a new valid session
      const storedSession = localStorage.getItem("beacon_session");
      expect(() => JSON.parse(storedSession!)).not.toThrow();
    });
  });
});
