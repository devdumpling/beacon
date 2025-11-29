import postgres from "postgres";
import { DATABASE_URL } from "$env/static/private";

export const sql = postgres(DATABASE_URL);

// Projects
export async function getProjects() {
  return sql`SELECT id, name, api_key, created_at FROM projects ORDER BY created_at DESC`;
}

export async function getProject(id: string) {
  const [project] = await sql`SELECT * FROM projects WHERE id = ${id}`;
  return project;
}

// Events
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
      date_trunc('day', timestamp)::date as day,
      event_name,
      count(*)::int as count
    FROM events
    WHERE project_id = ${projectId}
      AND timestamp > NOW() - INTERVAL '1 day' * ${days}
    GROUP BY 1, 2
    ORDER BY 1 DESC, 3 DESC
  `;
}

// Sessions
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

// Flags
export async function getFlags(projectId: string) {
  return sql`
    SELECT id, key, name, enabled, updated_at
    FROM flags
    WHERE project_id = ${projectId}
    ORDER BY key
  `;
}

export async function toggleFlag(flagId: string, enabled: boolean) {
  const [flag] = await sql`
    UPDATE flags
    SET enabled = ${enabled}, updated_at = NOW()
    WHERE id = ${flagId}
    RETURNING *
  `;
  return flag;
}

export async function createFlag(projectId: string, key: string, name: string) {
  const [flag] = await sql`
    INSERT INTO flags (project_id, key, name, enabled)
    VALUES (${projectId}, ${key}, ${name}, false)
    RETURNING *
  `;
  return flag;
}
