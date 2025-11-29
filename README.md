# Beacon

Lightweight, FedRAMP-compliant analytics platform.

## Stack

- **API**: Gleam on BEAM (Mist HTTP server)
- **Client SDK**: TypeScript, Web Worker, WebSocket
- **Dashboard**: SvelteKit + Tailwind
- **Database**: PostgreSQL

## Quick Start

### Prerequisites

- [pnpm](https://pnpm.io/) 10.24.0+
- [Gleam](https://gleam.run/) 1.0+
- [Docker](https://www.docker.com/) (for Postgres)
- [Just](https://github.com/casey/just)
- [dbmate](https://github.com/amacneil/dbmate)

### Setup

```bash
# Clone and enter directory
git clone https://github.com/you/beacon.git
cd beacon

# Copy environment file
cp .env.example .env

# Run setup (installs deps, starts Postgres, runs migrations)
just setup
```

### Development

```bash
# Start all services (API + Dashboard + Postgres)
just dev

# Or run individually:
just dev-api        # Gleam API on :4000
just dev-dashboard  # SvelteKit on :5173
```

### Database

```bash
just db-migrate     # Run migrations
just db-rollback    # Rollback last migration
just db-reset       # Drop and recreate
just db-shell       # Open psql
```

## Project Structure

```
beacon/
├── apps/
│   ├── api/              # Gleam backend
│   └── dashboard/        # SvelteKit dashboard
├── packages/
│   └── sdk/              # Client SDK (@beacon/sdk)
├── infra/
│   ├── docker-compose.yml
│   └── migrations/
└── justfile
```

## SDK Usage

```typescript
import { init, track, page, identify } from "@beacon/sdk";
import { BeaconProvider, useFlag, usePageView } from "@beacon/sdk/react";

// Initialize
init({ url: "wss://your-beacon-api.com", projectId: "your-project-id" });

// Track events
track("button_clicked", { button_id: "signup" });

// Page views
page();

// Identify users
identify("user_123", { plan: "pro", company: "Acme" });

// React: Feature flags
function MyComponent() {
  const showNewFeature = useFlag("new_feature", false);
  // ...
}
```

## Architecture

```
┌─────────────────────────┐
│     Your Application    │
│  ┌───────────────────┐  │
│  │  @beacon/sdk      │  │
│  │  (Web Worker)     │  │
│  └─────────┬─────────┘  │
└────────────┼────────────┘
             │ WebSocket
             ▼
┌─────────────────────────┐
│     Gleam API (BEAM)    │
│  Events ↑    ↓ Flags    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│       PostgreSQL        │
└─────────────────────────┘
             ↑
             │
┌─────────────────────────┐
│   SvelteKit Dashboard   │
└─────────────────────────┘
```

## License

MIT
