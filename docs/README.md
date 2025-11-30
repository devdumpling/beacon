# Beacon

Lightweight, privacy-first analytics platform.

> **Alpha Prototype** — Beacon is under active development. APIs may change.

## Goals

1. **Lightweight and simple** — Minimal API surface, robust code, performance over feature bloat
2. **Tiny client SDK** — <1kb gzipped, runs in a Web Worker off the main thread
3. **Self-host friendly** — Easy to fork and customize for your organization
4. **Privacy compliant** — Built for FedRAMP and HIPAA, designed for healthcare
5. **Scale on simplicity** — Push Postgres and Gleam (Erlang BEAM) as far as they go

## Stack

| Component  | Tech                              | Port |
| ---------- | --------------------------------- | ---- |
| API        | Gleam on BEAM (Mist HTTP/WS)      | 4000 |
| Dashboard  | SvelteKit + Tailwind              | 5173 |
| Database   | PostgreSQL (Docker)               | 5432 |
| Client SDK | TypeScript, Web Worker, WebSocket | -    |

## Quick Start

### Prerequisites

- [pnpm](https://pnpm.io/) 10.x
- [Gleam](https://gleam.run/) 1.x
- [Docker](https://www.docker.com/)
- [Just](https://github.com/casey/just)
- [dbmate](https://github.com/amacneil/dbmate)

### Setup

```bash
git clone https://github.com/devdumpling/beacon.git
cd beacon
cp .env.example .env
just setup    # Install deps, start Postgres, run migrations
just dev      # Start API (4000) + Dashboard (5173)
```

## Architecture

```
Client App → @beacon/sdk (Web Worker) → WebSocket → Gleam API (BEAM) → PostgreSQL
                                                          ↓
                                              SvelteKit Dashboard
```

## SDK Usage

```typescript
import { init, track, identify, page, flag } from "@beacon/sdk";

init({ url: "https://beacon.example.com", apiKey: "bk_your_api_key" });

track("button_clicked", { button_id: "signup" });
identify("user_123", { plan: "pro" });
page();

if (flag("new_feature")) {
  // Show new feature
}
```

See [sdk.md](./sdk.md) for full API reference.

## Project Structure

```
beacon/
├── apps/
│   ├── api/              # Gleam backend
│   ├── dashboard/        # SvelteKit dashboard
│   └── example-vanilla/  # Vanilla JS example
├── packages/
│   └── sdk/              # Client SDK (@beacon/sdk)
├── docs/                 # Documentation
├── infra/
│   ├── docker-compose.yml
│   └── migrations/
└── justfile
```

## Commands

```bash
# Development
just dev              # Start all services
just dev-api          # Gleam API only
just dev-dashboard    # SvelteKit only

# Database
just db-migrate       # Run migrations
just db-reset         # Drop and recreate
just db-shell         # Open psql

# Test
just test-api         # Gleam unit tests
just test-sdk         # SDK unit tests
just test-integration # Integration tests (requires running server)

# Build
just build            # Build all packages
just lint             # Lint and format
```

## Documentation

| Document                            | Description                       |
| ----------------------------------- | --------------------------------- |
| [Quickstart](./quickstart.md)       | Get running in 5 minutes          |
| [Roadmap](./roadmap.md)             | Road to alpha milestones          |
| [SDK Reference](./sdk.md)           | Client SDK installation and API   |
| [API Reference](./api.md)           | Server endpoints and architecture |
| [WebSocket Protocol](./protocol.md) | Wire protocol specification       |
| [Identity Tracking](./identity.md)  | User identification system        |

## Environment

Required `.env`:

```
DATABASE_URL=postgres://beacon:beacon@localhost:5432/beacon?sslmode=disable
PORT=4000
```

## License

MIT
