#!/usr/bin/env pnpm exec tsx
/**
 * Benchmark Validation Script
 *
 * Verifies load test events were persisted to PostgreSQL.
 * Counts events from load tests and optionally cleans them up.
 *
 * Usage:
 *   pnpm exec tsx scripts/benchmark-validate.ts           # Count and report
 *   pnpm exec tsx scripts/benchmark-validate.ts --clean   # Count, report, and cleanup
 */

import postgres from "postgres";

// ANSI colors
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://beacon:beacon@localhost:5432/beacon?sslmode=disable";

const sql = postgres(DATABASE_URL);

interface LoadTestStats {
  event_name: string;
  count: number;
  earliest: Date;
  latest: Date;
}

async function getLoadTestStats(): Promise<LoadTestStats[]> {
  const results = await sql<LoadTestStats[]>`
    SELECT
      event_name,
      COUNT(*)::int as count,
      MIN(timestamp) as earliest,
      MAX(timestamp) as latest
    FROM events
    WHERE event_name LIKE 'load_test%'
    GROUP BY event_name
    ORDER BY count DESC
  `;
  return results;
}

async function getRecentEventCount(minutes: number = 10): Promise<number> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const [result] = await sql<[{ count: number }]>`
    SELECT COUNT(*)::int as count
    FROM events
    WHERE event_name LIKE 'load_test%'
    AND timestamp > ${cutoff}
  `;
  return result.count;
}

async function cleanupLoadTestEvents(): Promise<number> {
  const [result] = await sql<[{ count: number }]>`
    WITH deleted AS (
      DELETE FROM events
      WHERE event_name LIKE 'load_test%'
      RETURNING 1
    )
    SELECT COUNT(*)::int as count FROM deleted
  `;
  return result.count;
}

async function cleanupLoadTestSessions(): Promise<number> {
  // Clean up sessions that only have load test events
  const [result] = await sql<[{ count: number }]>`
    WITH sessions_to_delete AS (
      SELECT s.id
      FROM sessions s
      LEFT JOIN events e ON s.id = e.session_id
      WHERE e.session_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM events e2
        WHERE e2.session_id = s.id
        AND e2.event_name NOT LIKE 'load_test%'
      )
    ),
    deleted AS (
      DELETE FROM sessions
      WHERE id IN (SELECT id FROM sessions_to_delete)
      RETURNING 1
    )
    SELECT COUNT(*)::int as count FROM deleted
  `;
  return result.count;
}

async function main() {
  const shouldClean = process.argv.includes("--clean");

  console.log(`${BOLD}Benchmark Validation${RESET}`);
  console.log("=".repeat(50));
  console.log();

  // Get load test statistics
  const stats = await getLoadTestStats();

  if (stats.length === 0) {
    console.log(`${YELLOW}No load test events found in database${RESET}`);
    console.log(`${DIM}Run load tests first: k6 run scripts/load-test.k6.js${RESET}`);
    await sql.end();
    return;
  }

  console.log(`${BOLD}Load Test Events${RESET}`);
  console.log("-".repeat(50));
  console.log(
    `${"Event Name".padEnd(25)} ${"Count".padStart(10)} ${"Time Range".padStart(12)}`
  );
  console.log("-".repeat(50));

  let totalEvents = 0;
  for (const stat of stats) {
    const duration =
      (new Date(stat.latest).getTime() - new Date(stat.earliest).getTime()) /
      1000;
    const durationStr = duration > 60 ? `${(duration / 60).toFixed(1)}m` : `${duration.toFixed(0)}s`;
    console.log(
      `${stat.event_name.padEnd(25)} ${stat.count.toString().padStart(10)} ${durationStr.padStart(12)}`
    );
    totalEvents += stat.count;
  }
  console.log("-".repeat(50));
  console.log(`${BOLD}${"Total".padEnd(25)}${RESET} ${totalEvents.toString().padStart(10)}`);
  console.log();

  // Recent events (last 10 minutes)
  const recentCount = await getRecentEventCount(10);
  console.log(`${BOLD}Recent Events (last 10 min):${RESET} ${recentCount}`);

  // Calculate throughput estimate
  if (stats.length > 0) {
    const burstEvents = stats.find((s) => s.event_name === "load_test_burst");
    if (burstEvents && burstEvents.count > 0) {
      const duration =
        (new Date(burstEvents.latest).getTime() -
          new Date(burstEvents.earliest).getTime()) /
        1000;
      if (duration > 0) {
        const throughput = burstEvents.count / duration;
        console.log(
          `${BOLD}Burst Throughput:${RESET} ${throughput.toFixed(1)} events/sec`
        );
      }
    }
  }

  console.log();

  // Cleanup if requested
  if (shouldClean) {
    console.log(`${YELLOW}Cleaning up load test data...${RESET}`);
    const deletedEvents = await cleanupLoadTestEvents();
    console.log(`  Deleted ${deletedEvents} events`);
    // Note: Sessions cleanup is more complex due to FK constraints
    // Skipping session cleanup for now
    console.log(`${GREEN}Cleanup complete${RESET}`);
  } else {
    console.log(`${DIM}Run with --clean to delete load test data${RESET}`);
  }

  console.log();
  console.log(`${GREEN}${BOLD}VALIDATION COMPLETE${RESET}`);

  await sql.end();
}

main().catch((err) => {
  console.error(`${RED}Error:${RESET}`, err);
  process.exit(1);
});
