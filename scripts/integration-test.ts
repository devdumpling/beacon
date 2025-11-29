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

const API_URL = process.env.API_URL || "http://localhost:4000";
const WS_URL = process.env.WS_URL || "ws://localhost:4000";

// Test UUIDs - the database expects UUID format for project, session, and anon IDs
const TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const TEST_SESSION_ID = "00000000-0000-0000-0000-000000000002";
const TEST_ANON_ID = "00000000-0000-0000-0000-000000000003";

// ANSI colors for output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

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
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
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
    assert(contentType?.includes("application/json") ?? false, "Expected JSON content-type");
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

  await test("Connect with valid params", async () => {
    const ws = await connectWs({
      project: TEST_PROJECT_ID,
      session: TEST_SESSION_ID,
      anon: TEST_ANON_ID,
    });
    ws.close();
  });

  await test("Ping/pong works", async () => {
    const ws = await connectWs({
      project: TEST_PROJECT_ID,
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
      project: TEST_PROJECT_ID,
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
      })
    );

    // Give it a moment to process
    await new Promise((r) => setTimeout(r, 100));
    ws.close();
  });

  await test("Send identify message with JSON string traits", async () => {
    const ws = await connectWs({
      project: TEST_PROJECT_ID,
      session: crypto.randomUUID(),
      anon: TEST_ANON_ID,
    });

    // API expects traits as JSON string (this is what the SDK now sends)
    ws.send(
      JSON.stringify({
        type: "identify",
        userId: "user-123",
        traits: JSON.stringify({ name: "Test User", plan: "pro" }),
      })
    );

    await new Promise((r) => setTimeout(r, 100));
    ws.close();
  });

  // Note: Server currently doesn't send initial flags on connect
  // This is a potential enhancement - flags are only broadcast on updates
  await test("Connection stays open without messages", async () => {
    const ws = await connectWs({
      project: TEST_PROJECT_ID,
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
      project: TEST_PROJECT_ID,
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
        })
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

  await httpTests();
  await websocketTests();
  await databaseTests();

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log("\n" + "─".repeat(50));
  if (failed === 0) {
    console.log(green(`All ${total} tests passed!`));
  } else {
    console.log(`${green(`${passed} passed`)}, ${red(`${failed} failed`)} of ${total} tests`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(red("Unexpected error:"), e);
  process.exit(1);
});
