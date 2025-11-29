# Beacon

Lightweight, FedRAMP-compliant analytics platform.

## Quick Start

```bash
just setup    # Install deps, start Postgres, run migrations
just dev      # Start API (4000) + Dashboard (5173)
```

## Architecture

```
Client App → @beacon/sdk (Web Worker) → WebSocket → Gleam API (BEAM) → PostgreSQL
                                                          ↓
                                              SvelteKit Dashboard
```

## Stack

| Component | Tech | Port |
|-----------|------|------|
| API | Gleam on BEAM (Mist HTTP/WS) | 4000 |
| Dashboard | SvelteKit + Tailwind | 5173 |
| Database | PostgreSQL (Docker) | 5432 |
| Client SDK | TypeScript, Web Worker, WebSocket | - |

## Project Structure

```
beacon/
├── apps/
│   ├── api/                 # Gleam backend
│   │   └── src/beacon/
│   │       ├── beacon.gleam        # Entry point
│   │       ├── config.gleam        # Env config
│   │       ├── router.gleam        # HTTP/WS routing
│   │       ├── types.gleam         # Shared types (Event, Flag)
│   │       ├── ws/handler.gleam    # WebSocket message handling
│   │       ├── services/           # Actor-based services
│   │       │   ├── events.gleam    # Event batching & flush
│   │       │   ├── flags.gleam     # Flag cache & broadcast
│   │       │   └── connections.gleam # WS connection registry
│   │       └── db/                 # Database queries
│   │           ├── pool.gleam      # Pog connection pool
│   │           ├── events.gleam    # Event inserts
│   │           └── flags.gleam     # Flag queries
│   └── dashboard/           # SvelteKit frontend
├── packages/
│   └── sdk/                 # Client SDK (@beacon/sdk)
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

Connect: `ws://localhost:4000/ws?project=ID&session=ID&anon=ID`

Messages (JSON):
```json
{"type": "event", "event": "name", "props": {}, "ts": 123}
{"type": "identify", "userId": "123", "traits": {}}
{"type": "ping"} → {"type": "pong"}
```

Server pushes flag updates: `{"type": "flags", "flags": {"key": true}}`

## Environment

Required `.env`:
```
DATABASE_URL=postgres://beacon:beacon@localhost:5432/beacon?sslmode=disable
PORT=4000
```
