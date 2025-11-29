# Beacon: Lightweight Analytics Platform

**Version:** 0.2.0  
**Stack:** Gleam · WebSocket · Postgres · SvelteKit

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER APPLICATIONS                        │
│                (Next.js / RR7 / TanStack Start)             │
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │ beacon.ts   │    │   Worker    │    │  flags.ts   │     │
│   │  (~200b)    │───▶│  WebSocket  │◀───│   (~150b)   │     │
│   └─────────────┘    └──────┬──────┘    └─────────────┘     │
└─────────────────────────────┼───────────────────────────────┘
                              │ ws://
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     GLEAM BACKEND (BEAM)                     │
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │   Router    │    │  WebSocket  │    │   Flag      │     │
│   │   (Mist)    │    │   Handler   │    │   Cache     │     │
│   └─────────────┘    └──────┬──────┘    └─────────────┘     │
│                             │                                │
│   ┌─────────────────────────┴───────────────────────────┐   │
│   │              Event Processor (GenServer)             │   │
│   │         Batches writes, manages sessions             │   │
│   └─────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         POSTGRES                             │
│                                                              │
│   events (partitioned)  │  sessions  │  flags  │  projects  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ read
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SVELTEKIT DASHBOARD                       │
│                                                              │
│   Event Explorer  │  Session Timeline  │  Flag Management   │
└─────────────────────────────────────────────────────────────┘
```

---

## Client SDK

Single WebSocket connection handles both events (up) and flags (down).

### Main Thread (~200 bytes gzipped)

```typescript
// beacon.ts
const w = new Worker(new URL('./beacon.worker.ts', import.meta.url), { type: 'module' });
const q: unknown[] = [];
let ok = false;

w.onmessage = (e) => {
  if (e.data === 'ready') { ok = true; q.forEach(m => w.postMessage(m)); q.length = 0; }
  if (e.data.type === 'flags') window.dispatchEvent(new CustomEvent('beacon:flags', { detail: e.data.flags }));
};

export const init = (cfg: { url: string; projectId: string }) => w.postMessage({ t: 'init', ...cfg });
export const track = (event: string, props?: Record<string, unknown>) => {
  const m = { t: 'e', event, props, ts: Date.now() };
  ok ? w.postMessage(m) : q.push(m);
};
export const identify = (userId: string, traits?: Record<string, unknown>) => w.postMessage({ t: 'id', userId, traits });
export const page = () => track('$page', { url: location.href, path: location.pathname, ref: document.referrer });
```

### Worker (~600 bytes gzipped)

```typescript
// beacon.worker.ts
let ws: WebSocket | null = null;
let url: string;
let projectId: string;
let userId: string | null = null;
let anonId: string;
let sessionId: string;
let queue: unknown[] = [];
let reconnectDelay = 1000;

const id = () => crypto.randomUUID();

function connect() {
  ws = new WebSocket(`${url}/ws?project=${projectId}&session=${sessionId}&anon=${anonId}`);
  
  ws.onopen = () => {
    reconnectDelay = 1000;
    self.postMessage('ready');
    flush();
  };
  
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'flags') self.postMessage({ type: 'flags', flags: msg.flags });
  };
  
  ws.onclose = () => {
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  };
}

function send(msg: unknown) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    queue.push(msg);
  }
}

function flush() {
  while (queue.length && ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(queue.shift()));
  }
}

self.onmessage = (e) => {
  const { t } = e.data;
  
  if (t === 'init') {
    url = e.data.url;
    projectId = e.data.projectId;
    anonId = id();
    sessionId = id();
    connect();
    return;
  }
  
  if (t === 'id') {
    userId = e.data.userId;
    send({ type: 'identify', userId, traits: e.data.traits });
    return;
  }
  
  if (t === 'e') {
    send({ type: 'event', event: e.data.event, props: e.data.props, ts: e.data.ts, userId });
  }
};
```

### Flag Access (~150 bytes)

```typescript
// flags.ts
let flags: Record<string, boolean> = {};

window.addEventListener('beacon:flags', ((e: CustomEvent) => {
  flags = e.detail;
}) as EventListener);

export const isEnabled = (key: string, fallback = false) => flags[key] ?? fallback;
```

### React Integration

```typescript
// use-beacon.tsx
import { useEffect, useSyncExternalStore } from 'react';
import { init, page, track, identify } from './beacon';
import { isEnabled } from './flags';

let listeners = new Set<() => void>();
let flags: Record<string, boolean> = {};

if (typeof window !== 'undefined') {
  window.addEventListener('beacon:flags', ((e: CustomEvent) => {
    flags = e.detail;
    listeners.forEach(fn => fn());
  }) as EventListener);
}

export function BeaconProvider({ children, url, projectId }: { 
  children: React.ReactNode; 
  url: string; 
  projectId: string;
}) {
  useEffect(() => { init({ url, projectId }); }, [url, projectId]);
  return children;
}

export function usePageView() {
  useEffect(() => { page(); }, []);
}

export function useFlag(key: string, fallback = false): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => flags[key] ?? fallback,
    () => fallback
  );
}

export { track, identify };
```

---

## Gleam Backend

### Dependencies (gleam.toml)

```toml
[dependencies]
gleam_stdlib = ">= 0.34.0 and < 2.0.0"
gleam_erlang = ">= 0.25.0 and < 1.0.0"
gleam_otp = ">= 0.10.0 and < 1.0.0"
mist = ">= 1.0.0 and < 2.0.0"
gleam_http = ">= 3.6.0 and < 4.0.0"
gleam_json = ">= 1.0.0 and < 2.0.0"
pog = ">= 1.0.0 and < 2.0.0"
envoy = ">= 1.0.0 and < 2.0.0"
```

### Project Structure

```
beacon/
├── gleam.toml
├── src/
│   ├── beacon.gleam              # Entry point
│   ├── router.gleam              # HTTP + WS routing
│   ├── ws/
│   │   ├── handler.gleam         # WebSocket lifecycle
│   │   └── registry.gleam        # Connection registry (for flag push)
│   ├── events/
│   │   ├── processor.gleam       # Batched DB writes
│   │   └── types.gleam           # Event types
│   ├── flags/
│   │   ├── cache.gleam           # In-memory flag state
│   │   └── evaluator.gleam       # Simple on/off lookup
│   ├── db/
│   │   ├── pool.gleam            # Postgres connection pool
│   │   ├── events.gleam          # Event queries
│   │   ├── flags.gleam           # Flag queries
│   │   └── sessions.gleam        # Session queries
│   └── config.gleam              # Environment config
└── test/
```

### Entry Point

```gleam
// src/beacon.gleam
import gleam/erlang/process
import gleam/io
import mist
import beacon/config
import beacon/router
import beacon/db/pool
import beacon/events/processor
import beacon/flags/cache
import beacon/ws/registry

pub fn main() {
  let cfg = config.load()
  
  // Start supervised processes
  let assert Ok(_) = pool.start(cfg.database_url)
  let assert Ok(_) = processor.start()
  let assert Ok(_) = cache.start()
  let assert Ok(_) = registry.start()
  
  // Load flags into cache
  cache.refresh()
  
  let assert Ok(_) =
    router.handler()
    |> mist.new
    |> mist.port(cfg.port)
    |> mist.start_http
  
  io.println("Beacon running on port " <> int.to_string(cfg.port))
  process.sleep_forever()
}
```

### Router

```gleam
// src/router.gleam
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/bytes_builder
import gleam/option.{None, Some}
import mist.{type Connection, type ResponseData}
import beacon/ws/handler as ws_handler

pub fn handler() -> fn(Request(Connection)) -> Response(ResponseData) {
  fn(req: Request(Connection)) {
    case request.path_segments(req) {
      ["ws"] -> handle_websocket(req)
      ["health"] -> health_response()
      _ -> not_found()
    }
  }
}

fn handle_websocket(req: Request(Connection)) -> Response(ResponseData) {
  let project_id = get_query_param(req, "project")
  let session_id = get_query_param(req, "session")
  let anon_id = get_query_param(req, "anon")
  
  case project_id, session_id, anon_id {
    Some(p), Some(s), Some(a) -> {
      mist.websocket(
        request: req,
        on_init: fn(_conn) { ws_handler.init(p, s, a) },
        on_close: fn(state) { ws_handler.close(state) },
        handler: fn(state, conn, msg) { ws_handler.handle(state, conn, msg) },
      )
    }
    _, _, _ -> bad_request("Missing required query params")
  }
}

fn health_response() -> Response(ResponseData) {
  response.new(200)
  |> response.set_body(mist.Bytes(bytes_builder.from_string("ok")))
}
```

### WebSocket Handler

```gleam
// src/ws/handler.gleam
import gleam/dynamic
import gleam/json
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/erlang/process.{type Subject}
import mist.{type WebsocketConnection, type WebsocketMessage, Text, Binary}
import beacon/events/processor
import beacon/events/types.{type Event, Event}
import beacon/flags/cache
import beacon/ws/registry

pub type State {
  State(
    project_id: String,
    session_id: String,
    anon_id: String,
    user_id: Option(String),
  )
}

pub fn init(project_id: String, session_id: String, anon_id: String) -> #(State, Option(process.Selector(a))) {
  let state = State(project_id, session_id, anon_id, None)
  
  // Register this connection for flag broadcasts
  registry.register(project_id, self())
  
  // Send current flags immediately
  let flags = cache.get_for_project(project_id)
  // (send flags to client - handled in handle function's return)
  
  #(state, None)
}

pub fn close(state: State) -> Nil {
  registry.unregister(state.project_id, self())
  Nil
}

pub fn handle(
  state: State,
  conn: WebsocketConnection,
  msg: WebsocketMessage,
) -> actor.Next(a, State) {
  case msg {
    Text(text) -> {
      case parse_message(text) {
        Ok(#("event", event_name, props, ts)) -> {
          processor.enqueue(Event(
            project_id: state.project_id,
            session_id: state.session_id,
            anon_id: state.anon_id,
            user_id: state.user_id,
            event_name: event_name,
            properties: props,
            timestamp: ts,
          ))
          actor.continue(state)
        }
        
        Ok(#("identify", user_id, traits, _)) -> {
          processor.enqueue_identify(state.project_id, state.anon_id, user_id, traits)
          actor.continue(State(..state, user_id: Some(user_id)))
        }
        
        Error(_) -> actor.continue(state)
      }
    }
    
    Binary(_) -> actor.continue(state)
    
    mist.Closed | mist.Shutdown -> actor.Stop(process.Normal)
  }
}

fn parse_message(text: String) -> Result(#(String, String, dynamic.Dynamic, Int), Nil) {
  // Parse incoming JSON message
  // Returns (type, event_name/user_id, props/traits, timestamp)
  todo
}
```

### Event Processor (Batched Writes)

```gleam
// src/events/processor.gleam
import gleam/erlang/process.{type Subject}
import gleam/otp/actor
import gleam/list
import beacon/events/types.{type Event}
import beacon/db/events as events_db

pub type Message {
  Enqueue(Event)
  Flush
}

pub type State {
  State(buffer: List(Event), count: Int)
}

const batch_size = 100
const flush_interval_ms = 5000

pub fn start() -> Result(Subject(Message), actor.StartError) {
  actor.start_spec(actor.Spec(
    init: fn() {
      // Schedule periodic flush
      process.send_after(self(), flush_interval_ms, Flush)
      actor.Ready(State(buffer: [], count: 0), process.new_selector())
    },
    init_timeout: 1000,
    loop: handle_message,
  ))
}

fn handle_message(msg: Message, state: State) -> actor.Next(Message, State) {
  case msg {
    Enqueue(event) -> {
      let new_buffer = [event, ..state.buffer]
      let new_count = state.count + 1
      
      case new_count >= batch_size {
        True -> {
          flush_buffer(new_buffer)
          actor.continue(State(buffer: [], count: 0))
        }
        False -> actor.continue(State(buffer: new_buffer, count: new_count))
      }
    }
    
    Flush -> {
      case state.buffer {
        [] -> Nil
        events -> flush_buffer(events)
      }
      process.send_after(self(), flush_interval_ms, Flush)
      actor.continue(State(buffer: [], count: 0))
    }
  }
}

fn flush_buffer(events: List(Event)) -> Nil {
  events_db.insert_batch(list.reverse(events))
  Nil
}
```

### Flag Cache

```gleam
// src/flags/cache.gleam
import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject}
import gleam/otp/actor
import beacon/db/flags as flags_db

pub type Flag {
  Flag(key: String, enabled: Bool)
}

pub type Message {
  Get(project_id: String, reply_to: Subject(List(Flag)))
  Refresh
  Update(project_id: String, key: String, enabled: Bool)
}

pub type State {
  State(flags: Dict(String, List(Flag)))
}

pub fn start() -> Result(Subject(Message), actor.StartError) {
  actor.start(State(flags: dict.new()), handle_message)
}

fn handle_message(msg: Message, state: State) -> actor.Next(Message, State) {
  case msg {
    Get(project_id, reply_to) -> {
      let flags = dict.get(state.flags, project_id) |> result.unwrap([])
      process.send(reply_to, flags)
      actor.continue(state)
    }
    
    Refresh -> {
      let flags = flags_db.get_all_grouped()
      actor.continue(State(flags: flags))
    }
    
    Update(project_id, key, enabled) -> {
      let project_flags = dict.get(state.flags, project_id) |> result.unwrap([])
      let updated = list.map(project_flags, fn(f) {
        case f.key == key {
          True -> Flag(..f, enabled: enabled)
          False -> f
        }
      })
      actor.continue(State(flags: dict.insert(state.flags, project_id, updated)))
    }
  }
}
```

### WebSocket Registry (for Flag Push)

```gleam
// src/ws/registry.gleam
import gleam/dict.{type Dict}
import gleam/set.{type Set}
import gleam/erlang/process.{type Pid, type Subject}
import gleam/otp/actor
import gleam/list
import mist

pub type Message {
  Register(project_id: String, pid: Pid)
  Unregister(project_id: String, pid: Pid)
  Broadcast(project_id: String, payload: String)
}

pub type State {
  State(connections: Dict(String, Set(Pid)))
}

pub fn start() -> Result(Subject(Message), actor.StartError) {
  actor.start(State(connections: dict.new()), handle_message)
}

fn handle_message(msg: Message, state: State) -> actor.Next(Message, State) {
  case msg {
    Register(project_id, pid) -> {
      let current = dict.get(state.connections, project_id) |> result.unwrap(set.new())
      let updated = set.insert(current, pid)
      actor.continue(State(connections: dict.insert(state.connections, project_id, updated)))
    }
    
    Unregister(project_id, pid) -> {
      let current = dict.get(state.connections, project_id) |> result.unwrap(set.new())
      let updated = set.delete(current, pid)
      actor.continue(State(connections: dict.insert(state.connections, project_id, updated)))
    }
    
    Broadcast(project_id, payload) -> {
      let pids = dict.get(state.connections, project_id) |> result.unwrap(set.new())
      set.to_list(pids)
      |> list.each(fn(pid) {
        // Send to each connected WebSocket
        process.send(pid, mist.Text(payload))
      })
      actor.continue(state)
    }
  }
}

pub fn broadcast_flags(project_id: String, flags: List(Flag)) -> Nil {
  let payload = json.object([
    #("type", json.string("flags")),
    #("flags", json.object(list.map(flags, fn(f) { #(f.key, json.bool(f.enabled)) }))),
  ])
  |> json.to_string
  
  process.send(registry_subject(), Broadcast(project_id, payload))
}
```

---

## Database Schema

```sql
-- Minimal schema for prototype

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events (partitioned by week for prototype)
CREATE TABLE events (
  id UUID DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  session_id UUID NOT NULL,
  anon_id UUID NOT NULL,
  user_id TEXT,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

-- Create initial partition
CREATE TABLE events_current PARTITION OF events
  FOR VALUES FROM (CURRENT_DATE) TO (CURRENT_DATE + INTERVAL '7 days');

CREATE INDEX idx_events_project_time ON events (project_id, timestamp DESC);
CREATE INDEX idx_events_session ON events (session_id);
CREATE INDEX idx_events_name ON events (project_id, event_name);

-- Sessions (populated async from events)
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  anon_id UUID NOT NULL,
  user_id TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  last_event_at TIMESTAMPTZ NOT NULL,
  event_count INT DEFAULT 1,
  entry_url TEXT,
  last_url TEXT
);

CREATE INDEX idx_sessions_project ON sessions (project_id, started_at DESC);

-- Feature Flags
CREATE TABLE flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, key)
);

CREATE INDEX idx_flags_project ON flags (project_id);

-- Users (created on identify)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  anon_id UUID NOT NULL,
  user_id TEXT,
  traits JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, anon_id)
);
```

---

## SvelteKit Dashboard

### Project Structure

```
dashboard/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +layout.server.ts      # Auth check
│   │   ├── +page.svelte           # Overview
│   │   ├── events/
│   │   │   └── +page.svelte       # Event explorer
│   │   ├── sessions/
│   │   │   ├── +page.svelte       # Session list
│   │   │   └── [id]/+page.svelte  # Session detail
│   │   ├── flags/
│   │   │   └── +page.svelte       # Flag management
│   │   └── auth/
│   │       ├── login/+page.svelte
│   │       └── callback/+server.ts
│   ├── lib/
│   │   ├── db.ts                  # Postgres client
│   │   ├── auth.ts                # Okta helpers
│   │   └── components/
│   │       ├── EventTable.svelte
│   │       ├── SessionTimeline.svelte
│   │       └── FlagToggle.svelte
│   └── hooks.server.ts            # Auth middleware
├── svelte.config.js
└── package.json
```

### Database Client

```typescript
// src/lib/db.ts
import postgres from 'postgres';
import { DATABASE_URL } from '$env/static/private';

export const sql = postgres(DATABASE_URL);

// Event queries
export async function getRecentEvents(projectId: string, limit = 100) {
  return sql`
    SELECT id, event_name, properties, timestamp, session_id, user_id
    FROM events
    WHERE project_id = ${projectId}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `;
}

export async function getEventCounts(projectId: string, days = 7) {
  return sql`
    SELECT 
      date_trunc('day', timestamp) as day,
      event_name,
      count(*) as count
    FROM events
    WHERE project_id = ${projectId}
      AND timestamp > NOW() - INTERVAL '${days} days'
    GROUP BY day, event_name
    ORDER BY day DESC
  `;
}

// Session queries
export async function getSessions(projectId: string, limit = 50) {
  return sql`
    SELECT id, user_id, started_at, last_event_at, event_count, entry_url
    FROM sessions
    WHERE project_id = ${projectId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
}

export async function getSessionEvents(sessionId: string) {
  return sql`
    SELECT event_name, properties, timestamp
    FROM events
    WHERE session_id = ${sessionId}
    ORDER BY timestamp ASC
  `;
}

// Flag queries
export async function getFlags(projectId: string) {
  return sql`
    SELECT id, key, name, enabled, updated_at
    FROM flags
    WHERE project_id = ${projectId}
    ORDER BY key
  `;
}

export async function toggleFlag(flagId: string, enabled: boolean) {
  return sql`
    UPDATE flags
    SET enabled = ${enabled}, updated_at = NOW()
    WHERE id = ${flagId}
    RETURNING *
  `;
}
```

### Flag Management Page

```svelte
<!-- src/routes/flags/+page.svelte -->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import FlagToggle from '$lib/components/FlagToggle.svelte';
  
  export let data;
  
  async function handleToggle(flagId: string, enabled: boolean) {
    await fetch('/api/flags/toggle', {
      method: 'POST',
      body: JSON.stringify({ flagId, enabled }),
      headers: { 'Content-Type': 'application/json' }
    });
    invalidateAll();
  }
</script>

<div class="p-6">
  <h1 class="text-2xl font-semibold mb-6">Feature Flags</h1>
  
  <div class="bg-white rounded-lg shadow">
    <table class="w-full">
      <thead class="border-b">
        <tr>
          <th class="text-left p-4">Key</th>
          <th class="text-left p-4">Name</th>
          <th class="text-left p-4">Status</th>
          <th class="text-left p-4">Updated</th>
        </tr>
      </thead>
      <tbody>
        {#each data.flags as flag}
          <tr class="border-b last:border-0">
            <td class="p-4 font-mono text-sm">{flag.key}</td>
            <td class="p-4">{flag.name}</td>
            <td class="p-4">
              <FlagToggle 
                enabled={flag.enabled} 
                on:toggle={(e) => handleToggle(flag.id, e.detail)} 
              />
            </td>
            <td class="p-4 text-gray-500 text-sm">
              {new Date(flag.updated_at).toLocaleString()}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
```

### Session Timeline Component

```svelte
<!-- src/lib/components/SessionTimeline.svelte -->
<script lang="ts">
  export let events: Array<{
    event_name: string;
    properties: Record<string, unknown>;
    timestamp: string;
  }>;
  
  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString();
  }
  
  function eventColor(name: string) {
    if (name === '$page') return 'bg-blue-500';
    if (name.startsWith('$')) return 'bg-gray-500';
    return 'bg-green-500';
  }
</script>

<div class="relative">
  <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
  
  {#each events as event}
    <div class="relative pl-10 pb-6">
      <div class="absolute left-2.5 w-3 h-3 rounded-full {eventColor(event.event_name)}"></div>
      
      <div class="bg-white rounded-lg shadow-sm p-4">
        <div class="flex justify-between items-start mb-2">
          <span class="font-medium">{event.event_name}</span>
          <span class="text-sm text-gray-500">{formatTime(event.timestamp)}</span>
        </div>
        
        {#if Object.keys(event.properties).length > 0}
          <pre class="text-xs bg-gray-50 p-2 rounded overflow-x-auto">{JSON.stringify(event.properties, null, 2)}</pre>
        {/if}
      </div>
    </div>
  {/each}
</div>
```

---

## Prototype Milestones

### Week 1: Foundation
- [ ] Gleam project with Mist HTTP server
- [ ] Postgres schema + connection pool
- [ ] WebSocket upgrade handler (no business logic yet)
- [ ] Client SDK skeleton (connects, sends ping)

### Week 2: Event Pipeline
- [ ] Event processor GenServer with batched writes
- [ ] Full WebSocket message parsing
- [ ] Client SDK: track, page, identify
- [ ] Session creation from first event

### Week 3: Feature Flags
- [ ] Flag cache GenServer
- [ ] Flag push over existing WebSocket
- [ ] Client flag store + React hook
- [ ] Dashboard: flag CRUD

### Week 4: Dashboard
- [ ] SvelteKit scaffold with Okta
- [ ] Event explorer table
- [ ] Session list + detail view
- [ ] Basic event count charts

---

## Open Questions

1. **WebSocket auth:** API key in query string, or upgrade only after HTTP auth handshake?

2. **Flag push trigger:** Dashboard hits Gleam API on toggle, or Postgres NOTIFY?

3. **Session timeout:** 30 min inactivity rotates session client-side. Server-side aggregation on close or periodic?

4. **Partition management:** Manual weekly partitions for prototype, pg_partman later?
