# SDK Reference

The Beacon SDK (`@beacon/sdk`) is a lightweight TypeScript client for tracking events, identifying users, and receiving feature flag updates.

## Installation

```bash
npm install @beacon/sdk
# or
pnpm add @beacon/sdk
```

## Quick Start

```typescript
import { init, track, identify, page, flag } from "@beacon/sdk";

// Initialize the SDK
init({
  url: "https://beacon.example.com",
  apiKey: "bk_your_api_key",
});

// Track a page view
page();

// Track custom events
track("button_clicked", { button_id: "signup" });

// Identify users after login
identify("user_123", { plan: "pro", email: "user@example.com" });

// Check feature flags
if (flag("new_checkout_flow")) {
  // Show new checkout
}
```

## API

### `init(config: BeaconConfig)`

Initialize the SDK. Must be called before any other SDK methods.

```typescript
interface BeaconConfig {
  /** Beacon server URL */
  url: string;
  /** Project API key */
  apiKey: string;
  /** Callback for connection state changes */
  onConnectionChange?: (state: ConnectionState) => void;
  /** Callback for errors */
  onError?: (error: string) => void;
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";
```

**Example:**

```typescript
init({
  url: "https://beacon.example.com",
  apiKey: "bk_abc123",
  onConnectionChange: (state) => {
    console.log("Connection state:", state);
  },
  onError: (error) => {
    console.error("Beacon error:", error);
  },
});
```

### `track(event: string, props?: EventProps)`

Track a custom event with optional properties.

```typescript
type EventProps = Record<string, string | number | boolean | null>;
```

**Examples:**

```typescript
// Simple event
track("signup_started");

// Event with properties
track("purchase_completed", {
  product_id: "sku-456",
  quantity: 2,
  price: 49.99,
  is_gift: false,
});
```

### `identify(userId: string, traits?: EventProps)`

Associate the current session with a user identity.

```typescript
identify("user_12345", {
  email: "jane@example.com",
  name: "Jane Doe",
  plan: "enterprise",
  company: "Acme Corp",
});
```

### `page(props?: EventProps)`

Track a page view with automatic URL capture.

Automatically captures:
- `url` - Full URL (`window.location.href`)
- `path` - Path only (`window.location.pathname`)
- `ref` - Referrer (`document.referrer`)

```typescript
// Basic page view
page();

// With additional context
page({ section: "blog", author: "jane" });
```

### `getConnectionState(): ConnectionState`

Get the current WebSocket connection state.

```typescript
if (getConnectionState() === "connected") {
  console.log("Ready to send events");
}
```

## Feature Flags

### `flag(key: string, fallback?: boolean): boolean`

Check if a feature flag is enabled. Exported as `flag` from `@beacon/sdk`.

```typescript
import { flag } from "@beacon/sdk";

if (flag("new_feature")) {
  // Show new feature
}

// With fallback (default: false)
if (flag("experimental_feature", false)) {
  // Show experimental feature
}
```

> **Note:** For advanced flag usage (subscribe, getAll), use the React hooks or import directly from the flags module.

## React Hooks

The SDK provides React-specific hooks for declarative usage:

```typescript
import {
  BeaconProvider,
  useFlag,
  useFlags,
  usePageView,
  useTrack,
  track,
  identify,
  page
} from "@beacon/sdk/react";

// Wrap your app with BeaconProvider
function App() {
  return (
    <BeaconProvider config={{ url: "https://beacon.example.com", apiKey: "bk_..." }}>
      <MyComponent />
    </BeaconProvider>
  );
}

function MyComponent() {
  // Check a single flag
  const isNewFeatureEnabled = useFlag("new_feature");

  // Get all flags
  const allFlags = useFlags();

  // Track page view on mount
  usePageView();

  // Get the track function
  const trackEvent = useTrack();

  if (!isNewFeatureEnabled) return null;

  return (
    <div onClick={() => trackEvent("clicked", { button: "cta" })}>
      New Feature!
    </div>
  );
}
```

### Available React Exports

| Export | Type | Description |
|--------|------|-------------|
| `BeaconProvider` | Component | Initializes SDK, wrap app with this |
| `useFlag(key, fallback?)` | Hook | Subscribe to a single flag |
| `useFlags()` | Hook | Subscribe to all flags |
| `usePageView(deps?)` | Hook | Track page view on mount |
| `useTrack()` | Hook | Returns the `track` function |
| `track`, `identify`, `page` | Function | Re-exported from core SDK |

## Browser Events

The SDK dispatches custom events on `window` for integration flexibility:

| Event | Detail | Description |
|-------|--------|-------------|
| `beacon:flags` | `Record<string, boolean>` | Fired when flags are updated |
| `beacon:connection` | `ConnectionState` | Fired when connection state changes |
| `beacon:error` | `string` | Fired when an error occurs |

```typescript
window.addEventListener("beacon:flags", (e) => {
  console.log("Flags updated:", e.detail);
});
```

## Architecture

The SDK uses a Web Worker for off-main-thread event processing:

```
Main Thread              Web Worker              Server
     │                        │                    │
     │───── init ────────────▶│                    │
     │                        │───── WebSocket ───▶│
     │                        │◀──── connected ────│
     │◀───── ready ───────────│                    │
     │                        │                    │
     │───── track ───────────▶│───── event ───────▶│
     │                        │                    │
     │                        │◀──── flags ────────│
     │◀───── flags ───────────│                    │
```

### Event Queuing

Events are queued until:
1. The worker signals "ready"
2. The WebSocket connection is established

Queued events are sent in order once the connection is ready.

### Reconnection

The SDK automatically reconnects with exponential backoff:
- Initial delay: 1 second
- Maximum delay: 30 seconds
- Backoff multiplier: 2x

### Session Management

Sessions automatically rotate after 30 minutes of inactivity. Each session gets a new UUID while the anonymous ID persists.

## SSR Support

The SDK safely handles server-side rendering. All methods check for `window` before executing browser APIs.

```typescript
// Safe to call during SSR - will be a no-op
init({ url: "...", apiKey: "..." });
track("page_view");
```

## Related Documentation

- [API Reference](./api.md) - Server endpoints and architecture
- [WebSocket Protocol](./protocol.md) - Wire protocol specification
- [Identity Tracking](./identity.md) - User identification and attribution
