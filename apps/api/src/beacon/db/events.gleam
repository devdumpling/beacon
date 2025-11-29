import gleam/list
import gleam/option.{None, Some}
import gleam/result
import pog
import beacon/types.{type Event}

/// Insert a batch of events into the database
/// Returns Ok(count) on success, Error on failure
pub fn insert_batch(
  db: pog.Connection,
  events: List(Event),
) -> Result(Int, pog.QueryError) {
  // Insert each event, collecting results
  let results =
    list.map(events, fn(event) {
      pog.query(
        "INSERT INTO events (project_id, session_id, anon_id, user_id, event_name, properties, timestamp)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, to_timestamp($7 / 1000.0))",
      )
      |> pog.parameter(pog.text(event.project_id))
      |> pog.parameter(pog.text(event.session_id))
      |> pog.parameter(pog.text(event.anon_id))
      |> pog.parameter(case event.user_id {
        Some(uid) -> pog.text(uid)
        None -> pog.null()
      })
      |> pog.parameter(pog.text(event.event_name))
      |> pog.parameter(pog.text(event.properties))
      |> pog.parameter(pog.int(event.timestamp))
      |> pog.execute(db)
    })

  // Check if any failed
  case list.find(results, fn(r) { result.is_error(r) }) {
    Ok(Error(e)) -> Error(e)
    _ -> Ok(list.length(events))
  }
}

/// Upsert a user record (create or update on identify)
/// Returns Ok(Nil) on success, Error on failure
pub fn upsert_user(
  db: pog.Connection,
  project_id: String,
  anon_id: String,
  user_id: String,
  traits: String,
) -> Result(Nil, pog.QueryError) {
  pog.query(
    "INSERT INTO users (project_id, anon_id, user_id, traits, last_seen_at)
     VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, NOW())
     ON CONFLICT (project_id, anon_id)
     DO UPDATE SET user_id = $3, traits = $4::jsonb, last_seen_at = NOW()",
  )
  |> pog.parameter(pog.text(project_id))
  |> pog.parameter(pog.text(anon_id))
  |> pog.parameter(pog.text(user_id))
  |> pog.parameter(pog.text(traits))
  |> pog.execute(db)
  |> result.map(fn(_) { Nil })
}
