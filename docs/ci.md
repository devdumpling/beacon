# CI/CD

GitHub Actions workflows for pull requests to `main`.

## Workflows

### CI (`ci.yml`)

Main workflow - all jobs must pass to merge.

| Job              | Description                         |
| ---------------- | ----------------------------------- |
| lint             | Gleam format + Prettier + ESLint    |
| test-sdk         | SDK unit tests                      |
| test-api         | Gleam API unit tests                |
| test-dashboard   | Dashboard tests (vitest)            |
| bench-size       | SDK bundle size check (<2KB worker) |
| test-integration | Integration tests                   |

### Load Tests (`load-test.yml`)

Non-blocking k6 performance tests. Runs in parallel with CI but failures won't block PRs.

- `bench-load` - Throughput test
- `bench-validate` - Verify DB persistence

## Environment

| Tool     | Version               |
| -------- | --------------------- |
| Node     | 24                    |
| pnpm     | from `packageManager` |
| OTP      | 28                    |
| Gleam    | 1.13                  |
| rebar3   | 3.25                  |
| Postgres | 16-alpine             |

## Running Locally

```bash
just lint           # Format and lint all code
just test-sdk       # SDK unit tests
just test-api       # Gleam unit tests
just test-dashboard # Dashboard tests
just test-integration # Integration tests (requires running server)
just bench-sdk-size # Bundle size check
just bench-load     # k6 load test (requires k6 + running server)
```

## Adding Tests

- **SDK**: `packages/sdk/test/*.test.ts`
- **API**: `apps/api/test/*_test.gleam`
- **Dashboard**: `apps/dashboard/**/*.test.ts`
- **Integration**: `scripts/integration-test.ts`
