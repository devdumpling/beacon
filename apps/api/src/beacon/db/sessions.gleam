import beacon/log
import gleam/option.{type Option}
import pog

/// Session record returned from database
pub type Session {
  Session(
    id: String,
    project_id: String,
    anon_id: String,
    user_id: Option(String),
  )
}

/// Create or update a session when a client connects
/// Uses ON CONFLICT to upsert - creates if new, updates last_event_at if exists
pub fn upsert(
  db: pog.Connection,
  project_id: String,
  session_id: String,
  anon_id: String,
) -> Result(Nil, pog.QueryError) {
  case
    pog.query(
      "INSERT INTO sessions (id, project_id, anon_id, started_at, last_event_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET last_event_at = NOW()",
    )
    |> pog.parameter(pog.text(session_id))
    |> pog.parameter(pog.text(project_id))
    |> pog.parameter(pog.text(anon_id))
    |> pog.execute(db)
  {
    Ok(_) -> Ok(Nil)
    Error(e) -> {
      log.error("Failed to upsert session", [
        log.str("session_id", session_id),
        log.str("project_id", project_id),
      ])
      Error(e)
    }
  }
}

/// Update last_event_at timestamp when an event is received
pub fn touch(
  db: pog.Connection,
  session_id: String,
) -> Result(Nil, pog.QueryError) {
  case
    pog.query(
      "UPDATE sessions SET last_event_at = NOW(), event_count = event_count + 1
       WHERE id = $1::uuid",
    )
    |> pog.parameter(pog.text(session_id))
    |> pog.execute(db)
  {
    Ok(_) -> Ok(Nil)
    Error(e) -> Error(e)
  }
}

/// Link a user_id to a session (called on identify)
pub fn set_user(
  db: pog.Connection,
  session_id: String,
  user_id: String,
) -> Result(Nil, pog.QueryError) {
  case
    pog.query("UPDATE sessions SET user_id = $2 WHERE id = $1::uuid")
    |> pog.parameter(pog.text(session_id))
    |> pog.parameter(pog.text(user_id))
    |> pog.execute(db)
  {
    Ok(_) -> Ok(Nil)
    Error(e) -> Error(e)
  }
}

/// Update entry URL for a session (first page view)
pub fn set_entry_url(
  db: pog.Connection,
  session_id: String,
  url: String,
) -> Result(Nil, pog.QueryError) {
  case
    pog.query(
      "UPDATE sessions SET entry_url = COALESCE(entry_url, $2), last_url = $2
       WHERE id = $1::uuid",
    )
    |> pog.parameter(pog.text(session_id))
    |> pog.parameter(pog.text(url))
    |> pog.execute(db)
  {
    Ok(_) -> Ok(Nil)
    Error(e) -> Error(e)
  }
}
