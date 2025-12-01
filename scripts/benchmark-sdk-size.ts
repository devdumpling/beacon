#!/usr/bin/env pnpm exec tsx
/**
 * SDK Bundle Size Benchmark
 *
 * Builds the SDK and measures bundle sizes (minified + gzipped).
 * Exits with code 1 if thresholds are exceeded.
 *
 * Usage: npx tsx scripts/benchmark-sdk-size.ts
 */

import { readFileSync, statSync, existsSync } from "fs";
import { gzipSync } from "zlib";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SDK_DIST = resolve(ROOT, "packages/sdk/dist");

// Thresholds (in bytes)
const WORKER_GZIP_THRESHOLD = 2000; // 2KB gzipped for worker
const TOTAL_GZIP_THRESHOLD = 5000; // 5KB total gzipped

// ANSI colors
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

interface BundleResult {
  file: string;
  minified: number;
  gzipped: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function measureFile(filePath: string): BundleResult | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath);
  const minified = statSync(filePath).size;
  const gzipped = gzipSync(content, { level: 9 }).length;

  return {
    file: filePath.split("/").pop()!,
    minified,
    gzipped,
  };
}

async function main() {
  console.log(`${BOLD}SDK Bundle Size Benchmark${RESET}`);
  console.log("=".repeat(50));
  console.log();

  // Build SDK
  console.log(`${DIM}Building SDK...${RESET}`);
  try {
    execSync("pnpm --filter @beacon/sdk build", {
      cwd: ROOT,
      stdio: "pipe",
    });
    console.log(`${GREEN}Build complete${RESET}\n`);
  } catch (error) {
    console.error(`${RED}Build failed${RESET}`);
    process.exit(1);
  }

  // Measure files
  const files = ["beacon.worker.js", "index.js", "react.js"];
  const results: BundleResult[] = [];

  for (const file of files) {
    const result = measureFile(resolve(SDK_DIST, file));
    if (result) {
      results.push(result);
    } else {
      console.log(`${YELLOW}Warning: ${file} not found${RESET}`);
    }
  }

  if (results.length === 0) {
    console.error(`${RED}No bundle files found!${RESET}`);
    process.exit(1);
  }

  // Print results table
  console.log(`${BOLD}Bundle Sizes${RESET}`);
  console.log("-".repeat(50));
  console.log(
    `${"File".padEnd(25)} ${"Minified".padStart(10)} ${"Gzipped".padStart(10)}`,
  );
  console.log("-".repeat(50));

  for (const result of results) {
    console.log(
      `${result.file.padEnd(25)} ${formatBytes(result.minified).padStart(10)} ${formatBytes(result.gzipped).padStart(10)}`,
    );
  }
  console.log("-".repeat(50));

  // Calculate totals
  const totalMinified = results.reduce((sum, r) => sum + r.minified, 0);
  const totalGzipped = results.reduce((sum, r) => sum + r.gzipped, 0);

  console.log(
    `${BOLD}${"Total".padEnd(25)}${RESET} ${formatBytes(totalMinified).padStart(10)} ${formatBytes(totalGzipped).padStart(10)}`,
  );
  console.log();

  // Check thresholds
  const workerResult = results.find((r) => r.file === "beacon.worker.js");
  let failed = false;

  console.log(`${BOLD}Threshold Checks${RESET}`);
  console.log("-".repeat(50));

  if (workerResult) {
    const workerPass = workerResult.gzipped <= WORKER_GZIP_THRESHOLD;
    const status = workerPass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    console.log(
      `Worker gzipped: ${formatBytes(workerResult.gzipped)} / ${formatBytes(WORKER_GZIP_THRESHOLD)} ${status}`,
    );
    if (!workerPass) failed = true;
  }

  const totalPass = totalGzipped <= TOTAL_GZIP_THRESHOLD;
  const totalStatus = totalPass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(
    `Total gzipped:  ${formatBytes(totalGzipped)} / ${formatBytes(TOTAL_GZIP_THRESHOLD)} ${totalStatus}`,
  );
  if (!totalPass) failed = true;

  console.log();

  if (failed) {
    console.log(`${RED}${BOLD}BENCHMARK FAILED${RESET}`);
    console.log(
      `${DIM}SDK bundles exceed size thresholds. Consider optimizing.${RESET}`,
    );
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}BENCHMARK PASSED${RESET}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
