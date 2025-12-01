# Benchmarking

Beacon performance benchmarks and testing methodology.

## Quick Start

```bash
just bench-sdk-size     # SDK bundle size (no server needed)
just bench-load         # Throughput test (requires server + k6)
just bench-connections  # Connection limits test
just bench-validate     # Verify DB persistence
just bench-clean        # Clean up test data
```

Requires [k6](https://k6.io/) for load tests: `brew install k6`

## Results

Tested on M1 MacBook Pro, December 2025.

### SDK Bundle Size

| File             | Minified | Gzipped |
| ---------------- | -------- | ------- |
| beacon.worker.js | 1.57 KB  | 838 B   |
| index.js         | 2.18 KB  | 907 B   |
| react.js         | 2.44 KB  | 1016 B  |
| **Total**        | 6.19 KB  | 2.70 KB |

**Worker is 838 bytes gzipped — <1KB goal met.**

### Throughput

| Metric            | Value                 |
| ----------------- | --------------------- |
| Events delivered  | 185,122               |
| Connection errors | 0                     |
| Success rate      | 100%                  |
| Ping RTT          | avg 0.23ms, p95 1.0ms |
| Connection time   | avg 3.8ms             |
| Concurrent VUs    | 200                   |

**Throughput rates:**

- Single client burst: ~92 events/sec sustained
- Concurrent scaling (200 VUs): ~834 events/sec average

### Connection Limits

| Metric                 | Value              |
| ---------------------- | ------------------ |
| Concurrent connections | 500                |
| Successful             | 1,332              |
| Failed                 | 0                  |
| Success rate           | 100%               |
| Connection time        | avg 11ms, p95 22ms |

## Testing Limitations

### File Descriptor Limits

macOS defaults to ~256 open files per process. At ~1000 concurrent WebSocket connections, the server hits `EMFILE` (too many open files).

**Workaround:** Increase the limit before starting the server:

```bash
ulimit -n 10000
just dev-api
```

Production deployments should configure appropriate limits via systemd or init scripts.

### Event Persistence Under Load

The API batches events (100 events or 5-second flush) for throughput. Under aggressive load testing with abrupt connection termination:

- Immediate persistence: ~60-80%
- After batch flush (~10s): ~80-90%

This is expected behavior for a batched system. Real-world usage with long-lived connections and graceful shutdowns will have higher persistence rates.

### Timer Resolution

Ping RTT measurements use millisecond precision (`Date.now()`). Sub-millisecond latencies appear as 0ms or 1ms. The p95=1.0ms ceiling indicates actual latency is faster than we can measure.

### Local Testing Only

Current benchmarks are local (localhost). Network latency, load balancers, and production database configurations will affect real-world performance.

## Test Scenarios

### Throughput Test (`load-test.k6.js`)

1. **Single client burst** (30s): 1 VU sending ~100 events/sec
2. **Concurrent scaling** (3m): Ramps 0→50→100→200→0 VUs, 10 events/sec each

### Connection Test (`load-test-connections.k6.js`)

Ramps to target connections (default 2000) and holds for 2 minutes:

- 1m: 25% of target
- 2m: 50% of target
- 3m: 75% of target
- 4m: 100% of target
- 5-6m: Hold at max
- 6.5m: Ramp down

## Future Work

- [ ] Test with production-like PostgreSQL configuration
- [ ] Benchmark with network latency simulation
- [ ] Test graceful shutdown persistence rates
- [ ] Higher connection limits (5000+)
- [ ] Memory and CPU profiling under load
- [ ] Sustained load testing (hours, not minutes)
