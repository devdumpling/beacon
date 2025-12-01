-- migrate:up

-- Dashboard users (separate from analytics users table)
CREATE TABLE dashboard_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard sessions (for Lucia auth)
CREATE TABLE dashboard_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_dashboard_sessions_user ON dashboard_sessions(user_id);


-- migrate:down

DROP TABLE IF EXISTS dashboard_sessions;
DROP TABLE IF EXISTS dashboard_users;
