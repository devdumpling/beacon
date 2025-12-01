# Identity Tracking

Beacon uses a three-tier identity system to track users from first visit through authentication.

## Identity Types

| ID           | Generator | Persistence             | Purpose                        |
| ------------ | --------- | ----------------------- | ------------------------------ |
| `anon_id`    | SDK       | Forever (localStorage)  | Permanent anonymous identifier |
| `session_id` | SDK       | 30-min timeout          | Groups related activity        |
| `user_id`    | Your app  | After identify()        | Links to your user system      |

## How It Works

### 1. Initial Visit (Anonymous)

When a user first visits your site:

```
SDK generates:
  anon_id:    "a1b2c3d4-..." (random UUID)
  session_id: "e5f6g7h8-..." (random UUID)

Events tracked with:
  {
    anon_id: "a1b2c3d4-...",
    session_id: "e5f6g7h8-...",
    user_id: null
  }
```

### 2. User Signs In

When you call `identify()`:

```typescript
identify("user@example.com", { plan: "pro" });
```

The server:

1. Links `anon_id` → `user_id` in the `users` table
2. Updates `user_id` in the WebSocket handler state
3. Updates `user_id` on the session record

### 3. Subsequent Events

After identification, all events include `user_id`:

```
{
  anon_id: "a1b2c3d4-...",
  session_id: "e5f6g7h8-...",
  user_id: "user@example.com"
}
```

### 4. Retroactive Attribution

Query all events from an anonymous user, even before they identified:

```sql
-- Get all events from user@example.com, including pre-login
SELECT e.*
FROM events e
JOIN users u ON e.anon_id = u.anon_id
WHERE u.user_id = 'user@example.com'
ORDER BY e.timestamp;
```

## Session Management

### Session Timeout

Sessions automatically rotate after 30 minutes of inactivity:

```
Last event: 10:00 AM → session_id: "abc..."
Next event: 10:45 AM → session_id: "xyz..." (new session, >30 min gap)
```

### Session Continuity

If activity continues within 30 minutes, the same session is used:

```
Event: 10:00 AM → session_id: "abc..."
Event: 10:15 AM → session_id: "abc..." (same session)
Event: 10:25 AM → session_id: "abc..." (same session)
```

### localStorage Persistence

Both IDs are stored in localStorage to survive page refreshes:

- `beacon_anon_id`: The anonymous UUID (persisted forever)
- `beacon_session`: JSON object `{id: "uuid", timestamp: 1234567890}`

The session timestamp is updated on every SDK activity (track, identify, page). On page load, if the stored session is less than 30 minutes old, it's reused; otherwise, a new session is created.

## Database Schema

### Users Table

Links anonymous IDs to user identities:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  anon_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  traits JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, anon_id)
);
```

### Sessions Table

Tracks session state:

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  anon_id UUID NOT NULL,
  user_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_event_at TIMESTAMPTZ DEFAULT NOW(),
  event_count INTEGER DEFAULT 0,
  entry_url TEXT,
  last_url TEXT
);
```

### Events Table

Stores all tracked events:

```sql
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  session_id UUID NOT NULL,
  anon_id UUID NOT NULL,
  user_id TEXT,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);
```

## Security Model

### Server-Side User ID Tracking

The `user_id` is tracked **server-side** in the WebSocket handler state, not sent with each event from the client. This prevents:

- User ID spoofing (client can't set arbitrary user_id)
- Session hijacking (user_id is bound to the connection)

### Flow

```
Client                          Server
  │                               │
  │──── identify(user_123) ──────▶│
  │                               │
  │                               │  state.user_id = "user_123"
  │                               │
  │──── track("purchase") ───────▶│
  │     (no user_id in payload)   │
  │                               │
  │                               │  Persist event with
  │                               │  user_id from state
```

## Common Patterns

### Track Before Login

```typescript
// User browses anonymously
track("product_viewed", { product_id: "sku-123" });
track("add_to_cart", { product_id: "sku-123" });

// User creates account
identify("newuser@example.com", { source: "checkout" });

// Previous events now attributed to this user
track("purchase_completed", { order_id: "ord-456" });
```

### Handle Logout

```typescript
// User logs out
// Option 1: Reload page (creates new anon_id, session_id)
window.location.reload();

// Option 2: Continue tracking as anonymous
// (no SDK method needed - just don't call identify again)
```

### Multiple Devices

When a user accesses from multiple devices:

```
Device A: anon_id_A → identify("user_123") → events linked
Device B: anon_id_B → identify("user_123") → events linked

Query by user_id returns events from both devices
```

## Analytics Queries

### User Journey

```sql
-- Complete journey for a user
SELECT
  e.event_name,
  e.properties,
  e.timestamp,
  CASE WHEN e.user_id IS NULL THEN 'anonymous' ELSE 'identified' END as state
FROM events e
JOIN users u ON e.anon_id = u.anon_id
WHERE u.user_id = 'target_user@example.com'
ORDER BY e.timestamp;
```

### Conversion Analysis

```sql
-- Anonymous → Identified conversion rate
SELECT
  DATE(s.started_at) as date,
  COUNT(DISTINCT s.anon_id) as sessions,
  COUNT(DISTINCT s.user_id) as identified,
  ROUND(100.0 * COUNT(DISTINCT s.user_id) / COUNT(DISTINCT s.anon_id), 2) as conversion_rate
FROM sessions s
WHERE s.started_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(s.started_at)
ORDER BY date DESC;
```

### Session Duration

```sql
-- Average session duration by user type
SELECT
  CASE WHEN user_id IS NULL THEN 'anonymous' ELSE 'identified' END as user_type,
  AVG(EXTRACT(EPOCH FROM (last_event_at - started_at)) / 60) as avg_duration_minutes
FROM sessions
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY user_type;
```

## Related Documentation

- [API Reference](./api.md) - Server endpoints and configuration
- [SDK Reference](./sdk.md) - Client SDK usage
- [WebSocket Protocol](./protocol.md) - Wire protocol specification
