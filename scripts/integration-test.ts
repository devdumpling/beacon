#!/usr/bin/env npx tsx
/**
 * Beacon Integration Test Script
 *
 * Tests the API server via HTTP and WebSocket connections.
 * Run with: npx tsx scripts/integration-test.ts
 *
 * Prerequisites:
 * - API server running on port 4000 (just dev-api)
 * - Database running and migrated (just db-up && just db-migrate)
 */

import postgres from "postgres";

const API_URL = process.env.API_URL || "http://localhost:4000";
const WS_URL = process.env.WS_URL || "ws://localhost:4000";
const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://beacon:beacon@localhost:5432/beacon";

// Test API key - must exist in database (created by seed/migration)
// The integration tests require a project with this API key to exist
const TEST_API_KEY = process.env.TEST_API_KEY || "test_api_key_12345";

// Test IDs for session/anon (can be any UUID format)
const TEST_SESSION_ID = "00000000-0000-0000-0000-000000000002";
const TEST_ANON_ID = "00000000-0000-0000-0000-000000000003";

// Project ID for direct API calls (like /api/flags/:project_id)
const TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000001";

// ANSI colors for output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

// ─────────────────────────────────────────────────────────────
// Database Helpers
// ─────────────────────────────────────────────────────────────

const sql = postgres(DATABASE_URL);

interface DbEvent {
  id: string;
  project_id: string;
  session_id: string;
  anon_id: string;
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

interface DbSession {
  id: string;
  project_id: string;
  anon_id: string;
  user_id: string | null;
  started_at: Date;
  last_event_at: Date;
  event_count: number;
}

interface DbUser {
  id: string;
  project_id: string;
  anon_id: string;
  user_id: string | null;
  traits: Record<string, unknown>;
}

async function queryEvents(sessionId: string): Promise<DbEvent[]> {
  return sql<DbEvent[]>`
    SELECT * FROM events WHERE session_id = ${sessionId}::uuid ORDER BY timestamp
  `;
}

async function querySession(sessionId: string): Promise<DbSession | null> {
  const rows = await sql<DbSession[]>`
    SELECT * FROM sessions WHERE id = ${sessionId}::uuid
  `;
  return rows[0] ?? null;
}

async function queryUser(
  projectId: string,
  anonId: string,
): Promise<DbUser | null> {
  const rows = await sql<DbUser[]>`
    SELECT * FROM users WHERE project_id = ${projectId}::uuid AND anon_id = ${anonId}::uuid
  `;
  return rows[0] ?? null;
}

async function cleanTestData(): Promise<void> {
  // Delete test data for the test project
  // Order matters due to foreign keys
  await sql`DELETE FROM events WHERE project_id = ${TEST_PROJECT_ID}::uuid`;
  await sql`DELETE FROM sessions WHERE project_id = ${TEST_PROJECT_ID}::uuid`;
  await sql`DELETE FROM users WHERE project_id = ${TEST_PROJECT_ID}::uuid`;
}

async function closeDb(): Promise<void> {
  await sql.end();
}

// ─────────────────────────────────────────────────────────────
// Test Framework
// ─────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`  ${green("✓")} ${name} ${dim(`(${duration}ms)`)}`);
  } catch (e) {
    const duration = Date.now() - start;
    const error = e instanceof Error ? e.message : String(e);
    results.push({ name, passed: false, error, duration });
    console.log(`  ${red("✗")} ${name}`);
    console.log(`    ${red(error)}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ||
        `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// HTTP Tests
// ─────────────────────────────────────────────────────────────

async function httpTests() {
  console.log("\n" + yellow("HTTP Endpoints"));

  await test("GET /health returns 200", async () => {
    const res = await fetch(`${API_URL}/health`);
    assertEqual(res.status, 200);
    const body = await res.text();
    assertEqual(body, "ok");
  });

  await test("GET /unknown returns 404", async () => {
    const res = await fetch(`${API_URL}/unknown`);
    assertEqual(res.status, 404);
  });

  await test("GET /api/flags/:project returns JSON", async () => {
    const res = await fetch(`${API_URL}/api/flags/${TEST_PROJECT_ID}`);
    assertEqual(res.status, 200);
    const contentType = res.headers.get("content-type");
    assert(
      contentType?.includes("application/json") ?? false,
      "Expected JSON content-type",
    );
    const body = await res.json();
    assert(typeof body === "object", "Expected JSON object");
  });
}

// ─────────────────────────────────────────────────────────────
// WebSocket Tests
// ─────────────────────────────────────────────────────────────

function connectWs(params: Record<string, string>): Promise<WebSocket> {
  const query = new URLSearchParams(params).toString();
  const url = `${WS_URL}/ws?${query}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket connection timeout"));
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeout);
      resolve(ws);
    };
    ws.onerror = (e) => {
      clearTimeout(timeout);
      reject(new Error("WebSocket connection failed"));
    };
  });
}

function waitForMessage(ws: WebSocket, timeout = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timeout waiting for message"));
    }, timeout);

    ws.onmessage = (e) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(e.data));
      } catch {
        resolve(e.data);
      }
    };
  });
}

async function websocketTests() {
  console.log("\n" + yellow("WebSocket"));

  await test("Connect with valid API key", async () => {
    const ws = await connectWs({
      key: TEST_API_KEY,
      session: TEST_SESSION_ID,
      anon: TEST_ANON_ID,
    });
    ws.close();
  });

  await test("Reject connection with invalid API key", async () => {
    const query = new URLSearchParams({
      key: "invalid_api_key",
      session: TEST_SESSION_ID,
      anon: TEST_ANON_ID,
    }).toString();

    // Try to connect with invalid API key - should fail
    const ws = new WebSocket(`${WS_URL}/ws?${query}`);

    const result = await new Promise<"closed" | "timeout">((resolve) => {
      const timeout = setTimeout(() => resolve("timeout"), 2000);
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve("closed");
      };
      ws.onclose = () => {
        clearTimeout(timeout);
        resolve("closed");
      };
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve("timeout"); // Unexpected - connection should not open
      };
    });

    assertEqual(
      result,
      "closed",
      "Connection should be rejected with invalid API key",
    );
  });

  await test("Ping/pong works", async () => {
    const ws = await connectWs({
      key: TEST_API_KEY,
      session: crypto.randomUUID(),
      anon: TEST_ANON_ID,
    });

    ws.send(JSON.stringify({ type: "ping" }));
    const response = (await waitForMessage(ws)) as { type: string };
    assertEqual(response.type, "pong");
    ws.close();
  });

  await test("Send event message with JSON string props", async () => {
    const ws = await connectWs({
      key: TEST_API_KEY,
      session: crypto.randomUUID(),
      anon: TEST_ANON_ID,
    });

    // API expects props as JSON string (this is what the SDK now sends)
    ws.send(
      JSON.stringify({
        type: "event",
        event: "test_event",
        props: JSON.stringify({ foo: "bar", num: 42 }),
        ts: Date.now(),
      }),
    );

    // Give it a moment to process
    await new Promise((r) => setTimeout(r, 100));
    ws.close();
  });

  await test("Send identify message with JSON string traits", async () => {
    const ws = await connectWs({
      key: TEST_API_KEY,
      session: crypto.randomUUID(),
      anon: TEST_ANON_ID,
    });

    // API expects traits as JSON string (this is what the SDK now sends)
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: "user-123",
        traits: JSON.stringify({ name: "Test User", plan: "pro" }),
      }),
    );

    await new Promise((r) => setTimeout(r, 100));
    ws.close();
  });

  // Note: Server currently doesn't send initial flags on connect
  // This is a potential enhancement - flags are only broadcast on updates
  await test("Connection stays open without messages", async () => {
    const ws = await connectWs({
      key: TEST_API_KEY,
      session: crypto.randomUUID(),
      anon: TEST_ANON_ID,
    });

    // Keep connection open briefly
    await new Promise((r) => setTimeout(r, 200));
    assert(ws.readyState === WebSocket.OPEN, "Connection should stay open");
    ws.close();
  });
}

// ─────────────────────────────────────────────────────────────
// Session Management Tests
// ─────────────────────────────────────────────────────────────

async function sessionTests() {
  console.log("\n" + yellow("Session Management"));

  await test("New connection creates session in database", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // Give time for session creation
    await new Promise((r) => setTimeout(r, 100));

    const session = await querySession(sessionId);
    assert(session !== null, "Session should exist in database");
    assertEqual(session!.project_id, TEST_PROJECT_ID);
    assertEqual(session!.anon_id, anonId);
    assert(session!.user_id === null, "User ID should be null before identify");

    ws.close();
  });

  await test("Identify links user_id to session", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();
    const userId = "test-user-" + Date.now();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // Send identify
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: userId,
        traits: JSON.stringify({ name: "Test User" }),
      }),
    );

    // Wait for processing
    await new Promise((r) => setTimeout(r, 200));

    const session = await querySession(sessionId);
    assert(session !== null, "Session should exist");
    assertEqual(session!.user_id, userId, "Session should have user_id set");

    ws.close();
  });

  await test("Identify creates user record", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();
    const userId = "test-user-" + Date.now();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // Send identify with traits
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: userId,
        traits: JSON.stringify({ plan: "pro", email: "test@example.com" }),
      }),
    );

    // Wait for processing
    await new Promise((r) => setTimeout(r, 200));

    const user = await queryUser(TEST_PROJECT_ID, anonId);
    assert(user !== null, "User record should exist");
    assertEqual(user!.user_id, userId);
    assertEqual(user!.traits.plan, "pro");
    assertEqual(user!.traits.email, "test@example.com");

    ws.close();
  });

  await test("Session reconnect updates last_event_at", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();

    // First connection
    const ws1 = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });
    await new Promise((r) => setTimeout(r, 100));
    const session1 = await querySession(sessionId);
    ws1.close();

    // Wait a bit
    await new Promise((r) => setTimeout(r, 100));

    // Second connection with same session
    const ws2 = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });
    await new Promise((r) => setTimeout(r, 100));
    const session2 = await querySession(sessionId);
    ws2.close();

    assert(
      session1 !== null && session2 !== null,
      "Both sessions should exist",
    );
    assert(
      session2!.last_event_at >= session1!.last_event_at,
      "last_event_at should be updated on reconnect",
    );
  });

  await test("Session event_count increments with multiple events", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // Send 5 events
    for (let i = 0; i < 5; i++) {
      ws.send(
        JSON.stringify({
          type: "event",
          event: `count_test_${i}`,
          props: "{}",
          ts: Date.now() + i,
        }),
      );
      // Small delay to ensure sequential processing
      await new Promise((r) => setTimeout(r, 50));
    }

    // Wait briefly for session updates (no need for full flush timer)
    await new Promise((r) => setTimeout(r, 200));

    const session = await querySession(sessionId);
    assert(session !== null, "Session should exist");
    assertEqual(
      session!.event_count,
      5,
      `Expected event_count of 5, got ${session!.event_count}`,
    );

    ws.close();
  });
}

// ─────────────────────────────────────────────────────────────
// Event Persistence Tests
// ─────────────────────────────────────────────────────────────

async function eventTests() {
  console.log("\n" + yellow("Event Persistence"));

  await test("Events persist to database with correct fields", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();
    const eventName = "test_click_" + Date.now();
    const ts = Date.now();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    ws.send(
      JSON.stringify({
        type: "event",
        event: eventName,
        props: JSON.stringify({ button: "submit", page: "/checkout" }),
        ts: ts,
      }),
    );

    // Wait for flush timer (5 seconds) plus buffer
    await new Promise((r) => setTimeout(r, 5500));
    ws.close();

    const events = await queryEvents(sessionId);
    assert(
      events.length >= 1,
      `Expected at least 1 event, got ${events.length}`,
    );

    const event = events.find((e) => e.event_name === eventName);
    assert(event !== undefined, `Event ${eventName} should exist`);
    assertEqual(event!.project_id, TEST_PROJECT_ID);
    assertEqual(event!.session_id, sessionId);
    assertEqual(event!.anon_id, anonId);
    assertEqual(event!.properties.button, "submit");
    assertEqual(event!.properties.page, "/checkout");
  });

  await test("Multiple events in batch all persist", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // Send 5 events
    for (let i = 0; i < 5; i++) {
      ws.send(
        JSON.stringify({
          type: "event",
          event: `batch_event_${i}`,
          props: JSON.stringify({ index: i }),
          ts: Date.now() + i,
        }),
      );
    }

    // Wait for flush timer (5 seconds) plus buffer
    await new Promise((r) => setTimeout(r, 5500));
    ws.close();

    const events = await queryEvents(sessionId);
    assertEqual(events.length, 5, `Expected 5 events, got ${events.length}`);
  });

  await test("Event user_id set after identify", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();
    const userId = "user-" + Date.now();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // Event before identify
    ws.send(
      JSON.stringify({
        type: "event",
        event: "before_identify",
        props: "{}",
        ts: Date.now(),
      }),
    );

    await new Promise((r) => setTimeout(r, 100));

    // Identify
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: userId,
        traits: "{}",
      }),
    );

    await new Promise((r) => setTimeout(r, 100));

    // Event after identify
    ws.send(
      JSON.stringify({
        type: "event",
        event: "after_identify",
        props: "{}",
        ts: Date.now(),
      }),
    );

    // Wait for flush timer (5 seconds) plus buffer
    await new Promise((r) => setTimeout(r, 5500));
    ws.close();

    const events = await queryEvents(sessionId);
    const beforeEvent = events.find((e) => e.event_name === "before_identify");
    const afterEvent = events.find((e) => e.event_name === "after_identify");

    assert(beforeEvent !== undefined, "before_identify event should exist");
    assert(afterEvent !== undefined, "after_identify event should exist");
    assert(
      beforeEvent!.user_id === null,
      "Event before identify should have null user_id",
    );
    assertEqual(
      afterEvent!.user_id,
      userId,
      "Event after identify should have user_id",
    );
  });
}

// ─────────────────────────────────────────────────────────────
// Identity Management Tests
// ─────────────────────────────────────────────────────────────

async function identityTests() {
  console.log("\n" + yellow("Identity Management"));

  await test("Re-identify with same user updates traits", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();
    const userId = "reidentify-user-" + Date.now();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // First identify
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: userId,
        traits: JSON.stringify({ plan: "free" }),
      }),
    );
    await new Promise((r) => setTimeout(r, 200));

    // Second identify with updated traits
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: userId,
        traits: JSON.stringify({ plan: "pro", upgraded: true }),
      }),
    );
    await new Promise((r) => setTimeout(r, 200));

    const user = await queryUser(TEST_PROJECT_ID, anonId);
    assert(user !== null, "User should exist");
    assertEqual(user!.traits.plan, "pro", "Traits should be updated");
    assertEqual(user!.traits.upgraded, true, "New trait should be added");

    ws.close();
  });

  await test("Different user_id updates anon mapping", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();
    const firstUserId = "first-user-" + Date.now();
    const secondUserId = "second-user-" + Date.now();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // First identify
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: firstUserId,
        traits: "{}",
      }),
    );
    await new Promise((r) => setTimeout(r, 200));

    // Second identify with different user
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: secondUserId,
        traits: "{}",
      }),
    );
    await new Promise((r) => setTimeout(r, 200));

    // Session should have second user
    const session = await querySession(sessionId);
    assertEqual(
      session!.user_id,
      secondUserId,
      "Session should have second user",
    );

    // Users table should map to second user (upsert on anon_id)
    const user = await queryUser(TEST_PROJECT_ID, anonId);
    assertEqual(
      user!.user_id,
      secondUserId,
      "User mapping should be to second user",
    );

    ws.close();
  });

  await test("Events track user switch correctly", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();
    const firstUserId = "switch-first-" + Date.now();
    const secondUserId = "switch-second-" + Date.now();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // Event as anonymous
    ws.send(
      JSON.stringify({
        type: "event",
        event: "anonymous_event",
        props: "{}",
        ts: Date.now(),
      }),
    );

    // Identify as first user
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: firstUserId,
        traits: "{}",
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    // Event as first user
    ws.send(
      JSON.stringify({
        type: "event",
        event: "first_user_event",
        props: "{}",
        ts: Date.now(),
      }),
    );

    // Identify as second user (user switch)
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: secondUserId,
        traits: "{}",
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    // Event as second user
    ws.send(
      JSON.stringify({
        type: "event",
        event: "second_user_event",
        props: "{}",
        ts: Date.now(),
      }),
    );

    // Wait for flush
    await new Promise((r) => setTimeout(r, 5500));
    ws.close();

    const events = await queryEvents(sessionId);
    const anonEvent = events.find((e) => e.event_name === "anonymous_event");
    const firstEvent = events.find((e) => e.event_name === "first_user_event");
    const secondEvent = events.find(
      (e) => e.event_name === "second_user_event",
    );

    assert(anonEvent !== undefined, "Anonymous event should exist");
    assert(firstEvent !== undefined, "First user event should exist");
    assert(secondEvent !== undefined, "Second user event should exist");

    assertEqual(
      anonEvent!.user_id,
      null,
      "Anonymous event should have null user_id",
    );
    assertEqual(
      firstEvent!.user_id,
      firstUserId,
      "First user event should have first user_id",
    );
    assertEqual(
      secondEvent!.user_id,
      secondUserId,
      "Second user event should have second user_id",
    );
  });

  await test("Multiple sessions with same anon_id share user mapping", async () => {
    const anonId = crypto.randomUUID();
    const session1Id = crypto.randomUUID();
    const session2Id = crypto.randomUUID();
    const userId = "multi-session-user-" + Date.now();

    // First session - identify user
    const ws1 = await connectWs({
      key: TEST_API_KEY,
      session: session1Id,
      anon: anonId,
    });

    ws1.send(
      JSON.stringify({
        type: "identify",
        userId: userId,
        traits: JSON.stringify({ name: "Test" }),
      }),
    );
    await new Promise((r) => setTimeout(r, 200));
    ws1.close();

    // Second session with same anon_id - should find user mapping
    const ws2 = await connectWs({
      key: TEST_API_KEY,
      session: session2Id,
      anon: anonId,
    });
    await new Promise((r) => setTimeout(r, 100));

    // User record should still exist with the mapping
    const user = await queryUser(TEST_PROJECT_ID, anonId);
    assert(user !== null, "User mapping should persist across sessions");
    assertEqual(user!.user_id, userId);
    assertEqual(user!.traits.name, "Test");

    ws2.close();
  });

  await test("All events have anon_id regardless of identify state", async () => {
    const sessionId = crypto.randomUUID();
    const anonId = crypto.randomUUID();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: anonId,
    });

    // Events before and after identify
    ws.send(
      JSON.stringify({
        type: "event",
        event: "pre_identify",
        props: "{}",
        ts: Date.now(),
      }),
    );

    ws.send(
      JSON.stringify({
        type: "identify",
        userId: "user-anon-test",
        traits: "{}",
      }),
    );
    await new Promise((r) => setTimeout(r, 100));

    ws.send(
      JSON.stringify({
        type: "event",
        event: "post_identify",
        props: "{}",
        ts: Date.now(),
      }),
    );

    await new Promise((r) => setTimeout(r, 5500));
    ws.close();

    const events = await queryEvents(sessionId);

    // Both events should have anon_id
    for (const event of events) {
      assertEqual(
        event.anon_id,
        anonId,
        `Event ${event.event_name} should have anon_id`,
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────
// WebSocket Edge Cases
// ─────────────────────────────────────────────────────────────

async function edgeCaseTests() {
  console.log("\n" + yellow("WebSocket Edge Cases"));

  await test("Malformed JSON is ignored gracefully", async () => {
    const ws = await connectWs({
      key: TEST_API_KEY,
      session: crypto.randomUUID(),
      anon: TEST_ANON_ID,
    });

    // Send malformed JSON - should not crash connection
    ws.send("not valid json {{{");
    ws.send("{incomplete");
    ws.send("");

    // Connection should still work
    await new Promise((r) => setTimeout(r, 100));
    assert(ws.readyState === WebSocket.OPEN, "Connection should stay open");

    // Ping should still work
    ws.send(JSON.stringify({ type: "ping" }));
    const response = (await waitForMessage(ws)) as { type: string };
    assertEqual(response.type, "pong");
    ws.close();
  });

  await test("Unknown message type is ignored", async () => {
    const ws = await connectWs({
      key: TEST_API_KEY,
      session: crypto.randomUUID(),
      anon: TEST_ANON_ID,
    });

    // Send unknown message types
    ws.send(JSON.stringify({ type: "unknown" }));
    ws.send(JSON.stringify({ type: "foo", data: "bar" }));

    await new Promise((r) => setTimeout(r, 100));
    assert(ws.readyState === WebSocket.OPEN, "Connection should stay open");
    ws.close();
  });

  await test("Missing required query params rejects connection", async () => {
    // Missing key
    const ws1 = new WebSocket(
      `${WS_URL}/ws?session=${TEST_SESSION_ID}&anon=${TEST_ANON_ID}`,
    );
    const result1 = await new Promise<string>((resolve) => {
      ws1.onclose = () => resolve("closed");
      ws1.onerror = () => resolve("closed");
      ws1.onopen = () => {
        ws1.close();
        resolve("opened");
      };
      setTimeout(() => resolve("timeout"), 2000);
    });
    assertEqual(result1, "closed", "Missing key should reject");

    // Missing session
    const ws2 = new WebSocket(
      `${WS_URL}/ws?key=${TEST_API_KEY}&anon=${TEST_ANON_ID}`,
    );
    const result2 = await new Promise<string>((resolve) => {
      ws2.onclose = () => resolve("closed");
      ws2.onerror = () => resolve("closed");
      ws2.onopen = () => {
        ws2.close();
        resolve("opened");
      };
      setTimeout(() => resolve("timeout"), 2000);
    });
    assertEqual(result2, "closed", "Missing session should reject");
  });

  await test("Event with missing fields uses defaults", async () => {
    const sessionId = crypto.randomUUID();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: TEST_ANON_ID,
    });

    // Event with only type field - should use defaults
    ws.send(JSON.stringify({ type: "event" }));

    // Wait for flush
    await new Promise((r) => setTimeout(r, 5500));
    ws.close();

    const events = await queryEvents(sessionId);
    assert(events.length >= 1, "Event should be created with defaults");
    assertEqual(events[0].event_name, "", "Default event name should be empty");
  });

  await test("Rapid messages are handled correctly", async () => {
    const sessionId = crypto.randomUUID();

    const ws = await connectWs({
      key: TEST_API_KEY,
      session: sessionId,
      anon: TEST_ANON_ID,
    });

    // Send 20 events rapidly
    for (let i = 0; i < 20; i++) {
      ws.send(
        JSON.stringify({
          type: "event",
          event: `rapid_${i}`,
          props: "{}",
          ts: Date.now(),
        }),
      );
    }

    // Wait for flush
    await new Promise((r) => setTimeout(r, 5500));
    ws.close();

    const events = await queryEvents(sessionId);
    assertEqual(events.length, 20, "All 20 rapid events should persist");
  });
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("Beacon Integration Tests");
  console.log(dim(`API: ${API_URL}`));
  console.log(dim(`WS:  ${WS_URL}`));

  // Check server is running
  try {
    const res = await fetch(`${API_URL}/health`);
    if (res.status !== 200) throw new Error("Health check failed");
  } catch (e) {
    console.error(red("\nServer not running! Start with: just dev-api\n"));
    process.exit(1);
  }

  // Clean test data before running tests
  console.log(dim("\nCleaning test data..."));
  await cleanTestData();

  await httpTests();
  await websocketTests();
  await sessionTests();
  await eventTests();
  await identityTests();
  await edgeCaseTests();

  // Cleanup
  await closeDb();

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log("\n" + "─".repeat(50));
  if (failed === 0) {
    console.log(green(`All ${total} tests passed!`));
  } else {
    console.log(
      `${green(`${passed} passed`)}, ${red(`${failed} failed`)} of ${total} tests`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(red("Unexpected error:"), e);
  process.exit(1);
});
