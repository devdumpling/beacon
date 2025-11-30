# Beacon

Lightweight, FedRAMP-compliant analytics platform.

## Quick Start

```bash
just setup    # Install deps, start Postgres, run migrations
just dev      # Start API (4000) + Dashboard (5173)
```

## Commands

**Always use `just` commands for running tasks.** See `justfile` for all available commands.

```bash
# Development
just dev              # Start all services (API + Dashboard)
just dev-api          # Start Gleam API only
just dev-dashboard    # Start SvelteKit dashboard only
just dev-example-vanilla  # Start vanilla example app (port 5174)

# Build
just build            # Build all packages
just build-api        # Build Gleam API
just build-sdk        # Build SDK package

# Test
just test             # Run all tests
just test-api         # Run Gleam unit tests
just test-integration # Run integration tests (requires running server)

# Database
just db-up            # Start Postgres container
just db-migrate       # Run migrations
just db-reset         # Drop and recreate database
just db-shell         # Open psql shell

# Lint
just lint             # Lint and format all code
```

## Architecture

```
Client App → @beacon/sdk (Web Worker) → WebSocket → Gleam API (BEAM) → PostgreSQL
                                                          ↓
                                              SvelteKit Dashboard
```

## Stack

| Component  | Tech                              | Port |
| ---------- | --------------------------------- | ---- |
| API        | Gleam on BEAM (Mist HTTP/WS)      | 4000 |
| Dashboard  | SvelteKit + Tailwind              | 5173 |
| Database   | PostgreSQL (Docker)               | 5432 |
| Client SDK | TypeScript, Web Worker, WebSocket | -    |

## Project Structure

```
beacon/
├── apps/
│   ├── api/                 # Gleam backend
│   │   ├── src/beacon/
│   │   │   ├── beacon.gleam        # Entry point (with proper error handling)
│   │   │   ├── config.gleam        # Env config
│   │   │   ├── log.gleam           # Structured JSON logging
│   │   │   ├── router.gleam        # HTTP/WS routing
│   │   │   ├── types.gleam         # Shared types (Event, Flag)
│   │   │   ├── ws/handler.gleam    # WebSocket message handling
│   │   │   ├── services/           # Actor-based services
│   │   │   │   ├── events.gleam    # Event batching & flush
│   │   │   │   ├── flags.gleam     # Flag cache & broadcast
│   │   │   │   └── connections.gleam # WS connection registry (ID-based)
│   │   │   └── db/                 # Database queries
│   │   │       ├── pool.gleam      # Pog connection pool + URL parsing
│   │   │       ├── events.gleam    # Event inserts (UUID/JSONB casts)
│   │   │       ├── flags.gleam     # Flag queries
│   │   │       ├── projects.gleam  # Project/API key lookup
│   │   │       └── sessions.gleam  # Session upsert/update
│   │   └── test/                   # Unit tests (gleeunit)
│   │       ├── beacon_test.gleam
│   │       └── pool_test.gleam
│   ├── dashboard/           # SvelteKit frontend
│   └── example-vanilla/     # Vanilla JS example app
├── packages/
│   └── sdk/                 # Client SDK (@beacon/sdk)
│       └── src/
│           ├── beacon.ts           # Core SDK (init, track, identify, page)
│           ├── beacon.worker.ts    # Web Worker for off-main-thread processing
│           ├── flags.ts            # Feature flags (isEnabled, subscribe, getAll)
│           ├── react.ts            # React hooks
│           └── index.ts            # Public exports
├── scripts/
│   └── integration-test.ts  # Integration test suite
├── infra/
│   ├── docker-compose.yml   # Postgres container
│   └── migrations/          # dbmate SQL migrations
├── .env                     # DATABASE_URL, PORT
└── justfile                 # Task runner
```

## Gleam Patterns (v1.x)

Uses latest Gleam ecosystem (gleam_otp 1.x, mist 5.x, pog 4.x):

**Actor pattern:**

```gleam
actor.new(initial_state)
|> actor.on_message(fn(state, msg) -> actor.Next(State, Message))
|> actor.start
```

**Decode pattern:**

```gleam
let decoder = {
  use field <- decode.field("name", decode.string)
  decode.success(MyType(field))
}
json.parse(text, decoder)
```

**Pog queries:**

```gleam
pog.query("SELECT ...")
|> pog.parameter(pog.text(value))
|> pog.returning(decoder)
|> pog.execute(db)
```

## Database

- **Credentials:** beacon:beacon@localhost:5432/beacon
- **Migrations:** `just db-migrate` / `just db-reset`
- **Tables:** projects, events (partitioned), sessions, flags, users

## WebSocket Protocol

Connect: `ws://localhost:4000/ws?key=API_KEY&session=ID&anon=ID`

The `key` parameter is the project's API key (looked up from the database to validate the connection).

Messages (JSON) - **props and traits must be JSON strings**:

```json
{"type": "event", "event": "name", "props": "{\"key\":\"value\"}", "ts": 123}
{"type": "identify", "userId": "123", "traits": "{\"name\":\"Jane\"}"}
{"type": "ping"} → {"type": "pong"}
```

Server pushes flag updates: `{"type": "flags", "flags": {"key": true}}`

## Testing

```bash
just test-api          # Run Gleam unit tests (22 tests)
just test-integration  # Run integration tests (26 tests, requires running server)
```

Integration tests cover HTTP endpoints, WebSocket connectivity, database flow, and identity management.

## Logging

The API uses structured JSON logging via `beacon/log.gleam`:

```gleam
import beacon/log

log.info("Server started", [log.int("port", 4000)])
log.error("Connection failed", [log.str("reason", "timeout")])
```

Output: `{"level":"info","msg":"Server started","port":4000}`

## SDK Usage

```typescript
import { init, track, identify, page, flag } from "@beacon/sdk";

// Initialize with your API key
init({ url: "https://beacon.example.com", apiKey: "bk_your_api_key" });

// Track events
track("button_clicked", { button_id: "signup" });

// Identify users
identify("user_456", { plan: "pro", email: "user@example.com" });

// Track page views
page();

// Feature flags
if (flag("new_feature")) {
  // Show new feature
}
```

## Identity Tracking

The SDK uses three IDs:

| ID | Generated By | Purpose |
|-----|-------------|---------|
| `anon_id` | SDK (on init) | Permanent anonymous ID, persists per SDK instance |
| `session_id` | SDK (on init/timeout) | Session ID, rotates after 30min inactivity |
| `user_id` | Your app (via identify) | Your system's user identifier |

See [docs/identity.md](docs/identity.md) for detailed identity tracking documentation.

**Flow:**

1. User visits → SDK generates `anon_id` + `session_id`
2. Events tracked with `user_id = NULL`
3. User signs in → call `identify("user@example.com")`
4. Server updates state, links `anon_id ↔ user_id` in `users` table
5. Future events include `user_id`
6. Join `events` with `users` on `anon_id` for retroactive attribution

**Key behavior:** The server tracks `user_id` in its WebSocket handler state (not from client messages) for security.

## Example Apps

### Vanilla (apps/example-vanilla)

Interactive demo showing anonymous→identified user flow.

```bash
# Start API + example app
just dev-api &
just dev-example-vanilla  # http://localhost:5174
```

**Features:**
- Mock sign-in/sign-out with sessionStorage
- Real-time event log
- Connection status indicator
- Collapsible "How it works" explanation
- Demonstrates: `init()`, `track()`, `identify()`, `page()`

## Environment

Required `.env`:

```
DATABASE_URL=postgres://beacon:beacon@localhost:5432/beacon?sslmode=disable
PORT=4000
```
