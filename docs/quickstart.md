# Quickstart Guide

Get Beacon running locally in 5 minutes.

## Prerequisites

- [pnpm](https://pnpm.io/) 10.x
- [Gleam](https://gleam.run/) 1.x
- [Docker](https://www.docker.com/)
- [Just](https://github.com/casey/just)
- [dbmate](https://github.com/amacneil/dbmate)

## 1. Clone and Setup

```bash
git clone https://github.com/devdumpling/beacon.git
cd beacon
cp .env.example .env
just setup
```

This installs dependencies, starts PostgreSQL, and runs migrations.

## 2. Start the Server

```bash
just dev
```

Services will start on:

- **API**: http://localhost:4000
- **Dashboard**: http://localhost:5173

## 3. Add the SDK to Your App

```bash
npm install @beacon/sdk
# or
pnpm add @beacon/sdk
```

> **WIP**: The SDK is not yet published to npm. For now, link it locally or copy from `packages/sdk`.

## 4. Initialize and Track Events

```typescript
import { init, track, identify, page, flag } from "@beacon/sdk";

// Initialize with your API key
init({
  url: "http://localhost:4000",
  apiKey: "bk_test_key", // Get from dashboard or database
});

// Track page views
page();

// Track custom events
track("button_clicked", { button_id: "signup" });

// Identify users after login
identify("user_123", { plan: "pro", email: "user@example.com" });

// Check feature flags
if (flag("new_checkout")) {
  // Show new checkout flow
}
```

## 5. React Integration

```typescript
import { BeaconProvider, useFlag, usePageView } from "@beacon/sdk/react";

function App() {
  return (
    <BeaconProvider config={{ url: "http://localhost:4000", apiKey: "bk_test_key" }}>
      <MyApp />
    </BeaconProvider>
  );
}

function MyApp() {
  usePageView(); // Track page view on mount

  const showBeta = useFlag("beta_features", false);

  return showBeta ? <BetaFeature /> : <StandardFeature />;
}
```

## 6. View Events in Dashboard

Open http://localhost:5173 to see tracked events and manage feature flags.

> **Note**: You'll need to register an account on first visit. Go to `/register` to create credentials.

---

## API Keys

For local development, you can create a project and API key directly in the database:

```bash
just db-shell
```

```sql
INSERT INTO projects (name, api_key)
VALUES ('My App', 'bk_test_' || gen_random_uuid()::text)
RETURNING api_key;
```

> **WIP**: Dashboard UI for project/API key management coming soon.

---

## What's Working

| Feature                | Status     |
| ---------------------- | ---------- |
| Event tracking         | ✅ Working |
| Page views             | ✅ Working |
| User identification    | ✅ Working |
| Session management     | ✅ Working |
| Feature flags (read)   | ✅ Working |
| WebSocket reconnection | ✅ Working |
| React hooks            | ✅ Working |

## What's WIP

| Feature                     | Status             |
| --------------------------- | ------------------ |
| npm package publishing      | 🚧 Not published   |
| Dashboard authentication    | 🚧 Open access     |
| Flag management UI          | 🚧 Basic           |
| Analytics visualizations    | 🚧 Basic           |
| Production deployment guide | 🚧 Coming soon     |
| Rate limiting               | 🚧 Not implemented |

---

## Example Apps

### Vanilla JavaScript

```bash
just dev-api &
just dev-example-vanilla
```

Open http://localhost:5174 for an interactive demo showing the full SDK lifecycle.

---

## Next Steps

- [SDK Reference](./sdk.md) — Full API documentation
- [Identity Tracking](./identity.md) — How user identification works
- [WebSocket Protocol](./protocol.md) — Wire protocol details
- [API Reference](./api.md) — Server endpoints
