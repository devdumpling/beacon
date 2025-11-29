-- migrate:up

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects (multi-tenancy)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events (partitioned by week)
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

-- Initial partition (current week)
CREATE TABLE events_default PARTITION OF events DEFAULT;

CREATE INDEX idx_events_project_time ON events (project_id, timestamp DESC);
CREATE INDEX idx_events_session ON events (session_id);
CREATE INDEX idx_events_name ON events (project_id, event_name);
CREATE INDEX idx_events_properties ON events USING GIN (properties);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  anon_id UUID NOT NULL,
  user_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_count INT DEFAULT 1,
  entry_url TEXT,
  last_url TEXT
);

CREATE INDEX idx_sessions_project ON sessions (project_id, started_at DESC);
CREATE INDEX idx_sessions_anon ON sessions (project_id, anon_id);

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

CREATE INDEX idx_users_project ON users (project_id);
CREATE INDEX idx_users_user_id ON users (project_id, user_id) WHERE user_id IS NOT NULL;

-- Seed a default project for local dev
INSERT INTO projects (name) VALUES ('Local Development');

-- Seed a test project with a known API key for integration tests
INSERT INTO projects (id, name, api_key) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Integration Test Project',
  'test_api_key_12345'
);

-- migrate:down

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS flags;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS projects;
