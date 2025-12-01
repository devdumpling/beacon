/**
 * Beacon API Connection Limits Test
 *
 * Tests maximum concurrent WebSocket connections.
 * Ramps from 0 to 2000 connections and holds to find breaking point.
 *
 * Usage: k6 run scripts/load-test-connections.k6.js
 *        k6 run scripts/load-test-connections.k6.js --env MAX_CONNECTIONS=5000
 */

import { WebSocket } from "k6/experimental/websockets";
import { Counter, Trend, Gauge } from "k6/metrics";

// Custom metrics
const successfulConnections = new Counter("successful_connections");
const failedConnections = new Counter("failed_connections");
const connectionTime = new Trend("connection_time", true);
const activeConnections = new Gauge("active_connections");

// Configuration
const API_KEY = __ENV.TEST_API_KEY || "test_api_key_12345";
const WS_URL = __ENV.WS_URL || "ws://localhost:4000";
const MAX_CONNECTIONS = parseInt(__ENV.MAX_CONNECTIONS || "2000", 10);

// Test scenarios - ramp to max and hold
export const options = {
  scenarios: {
    connection_stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: Math.floor(MAX_CONNECTIONS * 0.25) }, // 25%
        { duration: "1m", target: Math.floor(MAX_CONNECTIONS * 0.5) }, // 50%
        { duration: "1m", target: Math.floor(MAX_CONNECTIONS * 0.75) }, // 75%
        { duration: "1m", target: MAX_CONNECTIONS }, // 100%
        { duration: "2m", target: MAX_CONNECTIONS }, // Hold at max
        { duration: "30s", target: 0 }, // Ramp down
      ],
    },
  },
  thresholds: {
    // At least 90% of target connections should succeed
    successful_connections: [`count>=${Math.floor(MAX_CONNECTIONS * 0.9)}`],
    // Less than 10% failures
    failed_connections: [`count<${Math.floor(MAX_CONNECTIONS * 0.1)}`],
    // Connection time should be reasonable
    connection_time: ["p(95)<5000", "p(99)<10000"],
  },
};

// Helper to generate UUID
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Track active connection count
let currentActive = 0;

export default function () {
  const sessionId = generateUUID();
  const anonId = generateUUID();
  const url = `${WS_URL}/ws?key=${API_KEY}&session=${sessionId}&anon=${anonId}`;

  const connectStart = Date.now();

  const ws = new WebSocket(url);
  let pingInterval = null;

  ws.onopen = () => {
    const connectTime = Date.now() - connectStart;
    connectionTime.add(connectTime);
    successfulConnections.add(1);
    currentActive++;
    activeConnections.add(currentActive);

    // Send periodic pings to keep connection alive
    pingInterval = setInterval(() => {
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        // Connection may have closed
      }
    }, 5000);

    // Hold connection for the duration of this VU iteration
    setTimeout(() => {
      if (pingInterval) clearInterval(pingInterval);
      ws.close();
    }, 120000); // 2 minute hold per connection
  };

  ws.onmessage = () => {
    // Just acknowledge messages, no processing needed
  };

  ws.onerror = (e) => {
    failedConnections.add(1);
    if (pingInterval) clearInterval(pingInterval);
    console.log(`Connection error for VU ${__VU}: ${e.error()}`);
  };

  ws.onclose = () => {
    if (pingInterval) clearInterval(pingInterval);
    currentActive--;
    activeConnections.add(currentActive);
  };
}

// Summary handler
export function handleSummary(data) {
  const successful = data.metrics.successful_connections?.values?.count || 0;
  const failed = data.metrics.failed_connections?.values?.count || 0;
  const total = successful + failed;
  const successRate = total > 0 ? (successful / total) * 100 : 0;

  const summary = {
    timestamp: new Date().toISOString(),
    target_connections: MAX_CONNECTIONS,
    metrics: {
      successful_connections: successful,
      failed_connections: failed,
      success_rate: successRate,
      connection_time_avg: data.metrics.connection_time?.values?.avg || 0,
      connection_time_p95: data.metrics.connection_time?.values?.["p(95)"] || 0,
      connection_time_p99: data.metrics.connection_time?.values?.["p(99)"] || 0,
      peak_active:
        data.metrics.active_connections?.values?.max || successful,
    },
    thresholds: {
      passed: Object.values(data.thresholds || {}).every((t) => t.ok),
    },
  };

  return {
    stdout: `
=== Beacon Connection Limits Summary ===
Target Connections: ${MAX_CONNECTIONS}
Successful: ${successful}
Failed: ${failed}
Success Rate: ${successRate.toFixed(1)}%
Peak Active: ${summary.metrics.peak_active}
Connection Time: avg=${summary.metrics.connection_time_avg.toFixed(0)}ms, p95=${summary.metrics.connection_time_p95.toFixed(0)}ms, p99=${summary.metrics.connection_time_p99.toFixed(0)}ms
Thresholds: ${summary.thresholds.passed ? "PASSED" : "FAILED"}
========================================
`,
    "results/connection-limits-summary.json": JSON.stringify(summary, null, 2),
  };
}
