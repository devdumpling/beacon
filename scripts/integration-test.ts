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
  process.env.DATABASE_URL ||
  "postgres://beacon:beacon@localhost:5432/beacon";

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
// Database Verification (via HTTP API)
// ─────────────────────────────────────────────────────────────

async function databaseTests() {
  console.log("\n" + yellow("Database Integration"));

  // Note: These tests verify data flows through to the database
  // They require the dashboard API or direct DB access to verify

  await test("Events flow through without error", async () => {
    const ws = await connectWs({
      key: TEST_API_KEY,
      session: crypto.randomUUID(),
      anon: TEST_ANON_ID,
    });

    // Send multiple events to exercise batching
    for (let i = 0; i < 3; i++) {
      ws.send(
        JSON.stringify({
          type: "event",
          event: "integration_test",
          props: JSON.stringify({ test: true, iteration: i }),
          ts: Date.now(),
        }),
      );
    }

    // Wait for batch processing
    await new Promise((r) => setTimeout(r, 300));
    ws.close();

    // TODO: Query database to verify events were inserted
    // For now this passes if no error occurred
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
  await databaseTests();

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
