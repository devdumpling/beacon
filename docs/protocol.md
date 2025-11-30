# WebSocket Protocol

The Beacon WebSocket protocol defines how clients communicate with the server for event tracking, user identification, and feature flag distribution.

## Connection

### Endpoint

```
ws://host:port/ws?key=API_KEY&session=SESSION_ID&anon=ANON_ID
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Project API key (validated against database) |
| `session` | UUID | Client-generated session identifier |
| `anon` | UUID | Client-generated anonymous user identifier |

### Connection Lifecycle

1. Client initiates WebSocket connection with query parameters
2. Server validates API key against `projects` table
3. On success: WebSocket upgrade, session upserted to database
4. On failure: HTTP error response (400/401/500)

## Client-to-Server Messages

All messages are JSON objects with a `type` field.

### Event Message

Track a custom event with optional properties.

```json
{
  "type": "event",
  "event": "button_clicked",
  "props": "{\"button_id\":\"signup\",\"variant\":\"blue\"}",
  "ts": 1699876543210
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"event"` |
| `event` | string | Yes | Event name |
| `props` | string | No | JSON-encoded properties object |
| `ts` | integer | No | Unix timestamp in milliseconds |

**Note:** The `props` field must be a JSON-encoded string, not a raw object.

### Identify Message

Associate the session with a user identity.

```json
{
  "type": "identify",
  "userId": "user_12345",
  "traits": "{\"email\":\"user@example.com\",\"plan\":\"pro\"}"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"identify"` |
| `userId` | string | Yes | User identifier from your system |
| `traits` | string | No | JSON-encoded user properties |

**Note:** The `traits` field must be a JSON-encoded string, not a raw object.

### Ping Message

Keep the connection alive and test connectivity.

```json
{
  "type": "ping"
}
```

Server responds with:

```json
{
  "type": "pong"
}
```

## Server-to-Client Messages

### Flag Update

Pushed when feature flags change for the project.

```json
{
  "type": "flags",
  "flags": {
    "new_checkout": true,
    "dark_mode": false,
    "beta_features": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"flags"` |
| `flags` | object | Key-value map of flag names to boolean values |

### Pong Response

Response to client ping message.

```json
{
  "type": "pong"
}
```

## Message Flow Examples

### Basic Session

```
Client                          Server
  │                               │
  │──── WebSocket Connect ───────▶│
  │     ?key=bk_abc&session=...   │
  │                               │
  │◀─────── WS Upgrade ───────────│
  │                               │
  │──── event: page_view ────────▶│
  │                               │
  │──── event: button_click ─────▶│
  │                               │
  │◀─────── flags {...} ──────────│  (flag update broadcast)
  │                               │
```

> **Note:** Initial flag delivery on connection is planned but not yet implemented. Flags are currently pushed only when they change.

### With User Identification

```
Client                          Server
  │                               │
  │──── WebSocket Connect ───────▶│
  │                               │
  │◀─────── WS Upgrade ───────────│
  │                               │
  │──── event: page_view ────────▶│  (anonymous)
  │                               │
  │──── identify: user_123 ──────▶│
  │                               │
  │                               │  (server links anon_id → user_id)
  │                               │
  │──── event: purchase ─────────▶│  (associated with user_123)
  │                               │
```

## Error Handling

### Parse Errors

Invalid JSON or missing required fields are logged but do not close the connection:

```json
{"level":"warn","msg":"Failed to parse WebSocket message","session_id":"...","raw_message":"..."}
```

### Connection Errors

| HTTP Status | Cause |
|-------------|-------|
| 400 | Missing required query parameter |
| 401 | Invalid API key |
| 500 | Database error during validation |

### Reconnection

Clients should implement exponential backoff reconnection:

1. Initial delay: 1 second
2. Multiply delay by 2 on each failure
3. Cap maximum delay at 30 seconds
4. Reset delay on successful connection

## Security Considerations

1. **API Key Validation** - All connections require a valid API key
2. **Server-side User ID** - The `user_id` is tracked server-side after identification (not sent with each event) to prevent spoofing
3. **Session Binding** - Sessions are bound to projects and anonymous IDs at connection time
4. **TLS Required** - Production deployments should use `wss://` (WebSocket Secure)

## Rate Limiting

Currently no rate limiting is implemented. Future versions may include:

- Per-connection event rate limits
- Per-project connection limits
- Event size limits

## Compression

WebSocket compression is not currently enabled but may be added for bandwidth optimization in future versions.

## Related Documentation

- [API Reference](./api.md) - Server endpoints and configuration
- [SDK Reference](./sdk.md) - Client SDK usage
- [Identity Tracking](./identity.md) - User identification system
