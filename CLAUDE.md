# Beacon

Lightweight, privacy-first analytics platform. Alpha prototype.

**Goals:** Minimal API surface, <1KB SDK worker (838B gzipped), self-host friendly, FedRAMP/HIPAA compliant, scale on Postgres + Gleam simplicity.

## Quick Reference

```bash
just setup    # Install deps, start Postgres, run migrations
just dev      # Start API (4000) + Dashboard (5173)
just test     # Run all tests
just lint     # Lint and format all code
```

See `justfile` for all available commands.

## Architecture

```
Client App → @beacon/sdk (Web Worker) → WebSocket → Gleam API (BEAM) → PostgreSQL
                                                          ↓
                                              SvelteKit Dashboard
```

## Project Layout

| Directory               | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `apps/api/`             | Gleam backend (Mist HTTP/WS, actor services) |
| `apps/dashboard/`       | SvelteKit frontend                           |
| `apps/example-vanilla/` | Vanilla JS example app                       |
| `packages/sdk/`         | Client SDK (`@beacon/sdk`)                   |
| `docs/`                 | Project documentation                        |
| `infra/migrations/`     | dbmate SQL migrations                        |

## Key Patterns

### Gleam (v1.x with gleam_otp 1.x, mist 5.x, pog 4.x)

**Actor:**

```gleam
actor.new(initial_state)
|> actor.on_message(fn(state, msg) -> actor.Next(State, Message))
|> actor.start
```

**Pog queries:**

```gleam
pog.query("SELECT ...")
|> pog.parameter(pog.text(value))
|> pog.returning(decoder)
|> pog.execute(db)
```

### SDK

```typescript
import { init, track, identify, page, flag } from "@beacon/sdk";

init({ url: "https://beacon.example.com", apiKey: "bk_your_api_key" });
track("button_clicked", { button_id: "signup" });
identify("user_123", { plan: "pro" });
page();
if (flag("new_feature")) {
  /* ... */
}
```

### WebSocket Protocol

Connect: `ws://localhost:4000/ws?key=API_KEY&session=ID&anon=ID`

Messages (JSON) - **props and traits must be JSON strings**:

```json
{"type": "event", "event": "name", "props": "{\"key\":\"value\"}", "ts": 123}
{"type": "identify", "userId": "123", "traits": "{\"name\":\"Jane\"}"}
{"type": "ping"} → {"type": "pong"}
```

Server pushes: `{"type": "flags", "flags": {"key": true}}`

## Testing

```bash
just test-api          # Gleam unit tests (22 tests)
just test-integration  # Integration tests (26 tests, requires running server)
just test-sdk          # SDK unit tests (40 tests)
```

## Benchmarking

```bash
just bench-sdk-size    # Measure SDK bundle sizes (no server needed)
just bench-load        # k6 throughput test (requires server + k6)
just bench-connections # k6 connection limits test
just bench-validate    # Verify load test events persisted to DB
```

## Database

- **Credentials:** `beacon:beacon@localhost:5432/beacon`
- **Tables:** projects, events (partitioned), sessions, flags, users
- **Migrations:** `just db-migrate` / `just db-reset`

## Environment

Required `.env`:

```
DATABASE_URL=postgres://beacon:beacon@localhost:5432/beacon?sslmode=disable
PORT=4000
```

## Git Commits

Use conventional commits (`feat:`, `fix:`, `docs:`, etc.). Keep messages concise with useful descriptions. No co-author lines or generated-by footers.

## Documentation

For detailed documentation, see the `docs/` folder:

- [Project README](docs/README.md) - Overview and quick start
- [Quickstart](docs/quickstart.md) - Get running in 5 minutes
- [Roadmap](docs/roadmap.md) - Road to alpha milestones
- [SDK Reference](docs/sdk.md) - Client SDK API
- [API Reference](docs/api.md) - Server endpoints
- [WebSocket Protocol](docs/protocol.md) - Wire protocol
- [Identity Tracking](docs/identity.md) - User identification system
- [CI/CD](docs/ci.md) - GitHub Actions workflows
