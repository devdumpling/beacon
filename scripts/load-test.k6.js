/**
 * Beacon API Load Test - Throughput Benchmark
 *
 * Tests WebSocket throughput with two scenarios:
 * 1. Single connection burst - max events/sec from one client
 * 2. Concurrent scaling - ramp from 10 to 200 VUs
 *
 * Usage: k6 run scripts/load-test.k6.js
 *        k6 run scripts/load-test.k6.js --env TEST_API_KEY=your_key --env WS_URL=ws://your-server:4000
 */

import { WebSocket } from "k6/experimental/websockets";
import { check } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

// Custom metrics
const eventSendTime = new Trend("event_send_time", true);
const pingRtt = new Trend("ping_rtt", true);
const connectionTime = new Trend("connection_time", true);
const eventsDelivered = new Counter("events_delivered");
const connectionErrors = new Counter("connection_errors");
const successRate = new Rate("success_rate");

// Configuration
const API_KEY = __ENV.TEST_API_KEY || "test_api_key_12345";
const WS_URL = __ENV.WS_URL || "ws://localhost:4000";

// Test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Single connection sending events as fast as possible
    single_client_burst: {
      executor: "constant-vus",
      vus: 1,
      duration: "30s",
      tags: { scenario: "burst" },
      env: { SCENARIO: "burst" },
    },
    // Scenario 2: Concurrent connections ramping up
    concurrent_scaling: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 }, // Ramp to 50
        { duration: "1m", target: 100 }, // Ramp to 100
        { duration: "1m", target: 200 }, // Ramp to 200
        { duration: "30s", target: 0 }, // Ramp down
      ],
      startTime: "35s", // Start after burst test
      tags: { scenario: "scaling" },
      env: { SCENARIO: "scaling" },
    },
  },
  thresholds: {
    event_send_time: ["p(95)<500", "p(99)<1000"], // 95th < 500ms, 99th < 1s
    ping_rtt: ["p(95)<200", "p(99)<500"], // Ping RTT thresholds
    connection_time: ["p(95)<2000"], // Connection < 2s
    connection_errors: ["count<10"], // Max 10 connection errors total
    success_rate: ["rate>0.95"], // 95%+ success rate
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

// Main test function
export default function () {
  const scenario = __ENV.SCENARIO || "scaling";
  const sessionId = generateUUID();
  const anonId = generateUUID();
  const url = `${WS_URL}/ws?key=${API_KEY}&session=${sessionId}&anon=${anonId}`;

  const connectStart = Date.now();

  const ws = new WebSocket(url);
  let eventsSent = 0;
  let pingStart = 0;
  let eventInterval = null;
  let pingInterval = null;

  ws.onopen = () => {
    const connectTime = Date.now() - connectStart;
    connectionTime.add(connectTime);
    successRate.add(1);

    // Start sending events based on scenario
    if (scenario === "burst") {
      // Burst mode: send as fast as possible (~100 events/sec)
      eventInterval = setInterval(() => {
        const sendStart = Date.now();
        ws.send(
          JSON.stringify({
            type: "event",
            event: "load_test_burst",
            props: JSON.stringify({ seq: eventsSent, ts: sendStart }),
            ts: sendStart,
          })
        );
        eventsSent++;
        eventsDelivered.add(1);
        eventSendTime.add(Date.now() - sendStart);
      }, 10);

      // Periodic pings to measure RTT
      pingInterval = setInterval(() => {
        pingStart = Date.now();
        ws.send(JSON.stringify({ type: "ping" }));
      }, 1000);

      // Close after duration
      setTimeout(() => {
        if (eventInterval) clearInterval(eventInterval);
        if (pingInterval) clearInterval(pingInterval);
        ws.close();
      }, 28000);
    } else {
      // Scaling mode: moderate rate per VU (10 events/sec)
      eventInterval = setInterval(() => {
        const sendStart = Date.now();
        ws.send(
          JSON.stringify({
            type: "event",
            event: "load_test_scaling",
            props: JSON.stringify({ seq: eventsSent, vu: __VU }),
            ts: sendStart,
          })
        );
        eventsSent++;
        eventsDelivered.add(1);
        eventSendTime.add(Date.now() - sendStart);
      }, 100);

      // Periodic pings
      pingInterval = setInterval(() => {
        pingStart = Date.now();
        ws.send(JSON.stringify({ type: "ping" }));
      }, 2000);

      // Send identify after 1 second
      setTimeout(() => {
        ws.send(
          JSON.stringify({
            type: "identify",
            userId: `load_user_${__VU}`,
            traits: JSON.stringify({ loadTest: true, vu: __VU }),
          })
        );
      }, 1000);

      // Close after iteration
      setTimeout(() => {
        if (eventInterval) clearInterval(eventInterval);
        if (pingInterval) clearInterval(pingInterval);
        ws.close();
      }, 10000);
    }
  };

  ws.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      if (data.type === "pong" && pingStart > 0) {
        pingRtt.add(Date.now() - pingStart);
        pingStart = 0;
      }
    } catch {
      // Ignore parse errors
    }
  };

  ws.onerror = (e) => {
    connectionErrors.add(1);
    successRate.add(0);
    if (eventInterval) clearInterval(eventInterval);
    if (pingInterval) clearInterval(pingInterval);
    console.log(`WebSocket error: ${e.error()}`);
  };

  ws.onclose = () => {
    if (eventInterval) clearInterval(eventInterval);
    if (pingInterval) clearInterval(pingInterval);
  };
}

// Summary handler for custom output
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: {
      events_delivered: data.metrics.events_delivered?.values?.count || 0,
      event_send_time_p95:
        data.metrics.event_send_time?.values?.["p(95)"] || 0,
      event_send_time_p99:
        data.metrics.event_send_time?.values?.["p(99)"] || 0,
      ping_rtt_avg: data.metrics.ping_rtt?.values?.avg || 0,
      ping_rtt_p95: data.metrics.ping_rtt?.values?.["p(95)"] || 0,
      connection_time_avg: data.metrics.connection_time?.values?.avg || 0,
      connection_errors: data.metrics.connection_errors?.values?.count || 0,
      success_rate: data.metrics.success_rate?.values?.rate || 0,
    },
    thresholds: {
      passed: Object.values(data.thresholds || {}).every((t) => t.ok),
    },
  };

  return {
    stdout: `
=== Beacon Load Test Summary ===
Events Delivered: ${summary.metrics.events_delivered}
Event Send Time: p95=${summary.metrics.event_send_time_p95.toFixed(2)}ms, p99=${summary.metrics.event_send_time_p99.toFixed(2)}ms
Ping RTT: avg=${summary.metrics.ping_rtt_avg.toFixed(2)}ms, p95=${summary.metrics.ping_rtt_p95.toFixed(2)}ms
Connection Time: avg=${summary.metrics.connection_time_avg.toFixed(2)}ms
Connection Errors: ${summary.metrics.connection_errors}
Success Rate: ${(summary.metrics.success_rate * 100).toFixed(1)}%
Thresholds: ${summary.thresholds.passed ? "PASSED" : "FAILED"}
================================
`,
    "results/load-test-summary.json": JSON.stringify(summary, null, 2),
  };
}
