# API Reference

The Beacon API server is a Gleam/BEAM application that handles WebSocket connections, event ingestion, and feature flag distribution.

## Endpoints

### Health Check

```
GET /health
```

Returns `ok` with status 200 if the server is running.

**Response:** `200 OK` with body `ok`

### Flags API

```
GET /api/flags/:project_id
```

Returns the current feature flags for a project as JSON.

**Response:** `200 OK` with JSON body

```json
{
  "feature_x": true,
  "feature_y": false
}
```

### WebSocket Connection

```
GET /ws?key=API_KEY&session=SESSION_ID&anon=ANON_ID
```

Establishes a WebSocket connection for real-time event streaming and flag updates.

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `key` | Yes | Project API key (e.g., `bk_abc123...`) |
| `session` | Yes | Client-generated session UUID |
| `anon` | Yes | Client-generated anonymous user UUID |

**Error Responses:**

- `400 Bad Request` - Missing required query parameter
- `401 Unauthorized` - Invalid API key
- `500 Internal Server Error` - Database error during validation

## WebSocket Protocol

See [protocol.md](./protocol.md) for detailed WebSocket message format documentation.

## Architecture

The API server uses an actor-based architecture with the following services:

- **Events Service** - Batches and persists events to PostgreSQL
- **Flags Service** - Caches and distributes feature flags
- **Connections Service** - Manages active WebSocket connections for flag broadcasts

### Request Flow

```
Client → WebSocket → Handler → Events Service → PostgreSQL
                           ↘ Flags Service ←→ Cache
```

### Concurrency Model

The server runs on the BEAM virtual machine, providing:

- Lightweight processes for each connection
- Automatic process supervision and restart
- Message-based actor communication
- No shared mutable state

## Configuration

Environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection URL |
| `PORT` | No | 4000 | HTTP/WebSocket server port |

## Database Schema

See the migration files in `infra/migrations/` for the complete schema. Key tables:

- `projects` - Project configuration and API keys
- `events` - Event storage (partitioned by time)
- `sessions` - Session tracking
- `flags` - Feature flag definitions
- `users` - User identity mapping

## Error Handling

The API uses structured JSON logging for all errors:

```json
{"level":"error","msg":"Failed to parse WebSocket message","session_id":"abc123","raw_message":"..."}
```

Errors are logged but do not terminate connections. The server prioritizes availability and will:

1. Log parse errors and continue processing
2. Maintain connection state even during partial failures

## Related Documentation

- [SDK Reference](./sdk.md) - Client SDK documentation
- [WebSocket Protocol](./protocol.md) - Message format specification
- [Identity Tracking](./identity.md) - User identification system
