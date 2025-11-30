import beacon/log
import beacon/types.{type Event}
import gleam/int
import gleam/list
import gleam/option.{None, Some}
import gleam/result
import pog

/// Format a pog.QueryError into a human-readable string for logging
fn format_query_error(err: pog.QueryError) -> String {
  case err {
    pog.ConstraintViolated(message, constraint, _detail) ->
      "Constraint violated: " <> constraint <> " - " <> message
    pog.PostgresqlError(code, name, message) ->
      "PostgreSQL error [" <> code <> "/" <> name <> "]: " <> message
    pog.UnexpectedArgumentCount(expected, got) ->
      "Unexpected argument count: expected "
      <> int.to_string(expected)
      <> ", got "
      <> int.to_string(got)
    pog.UnexpectedArgumentType(expected, got) ->
      "Unexpected argument type: expected " <> expected <> ", got " <> got
    pog.UnexpectedResultType(_decode_errors) -> "Unexpected result type"
    pog.QueryTimeout -> "Query timeout"
    pog.ConnectionUnavailable -> "Connection unavailable"
  }
}

/// Insert a batch of events into the database
/// Returns Ok(success_count) on success, Error on complete failure
/// Logs any individual event insert failures
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

  // Count successes and failures
  let success_count =
    list.count(results, fn(r) { result.is_ok(r) })
  let failure_count =
    list.count(results, fn(r) { result.is_error(r) })

  // Log any failures
  case failure_count > 0 {
    True -> {
      // Find first error for logging
      case list.find(results, fn(r) { result.is_error(r) }) {
        Ok(Error(e)) -> {
          log.error("Failed to insert some events in batch", [
            log.int("success_count", success_count),
            log.int("failure_count", failure_count),
            log.str("first_error", format_query_error(e)),
          ])
        }
        _ -> Nil
      }
    }
    False -> Nil
  }

  // Return success count if any succeeded, otherwise return first error
  case success_count > 0 {
    True -> Ok(success_count)
    False ->
      case list.find(results, fn(r) { result.is_error(r) }) {
        Ok(Error(e)) -> Error(e)
        _ -> Ok(0)
      }
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
  case
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
  {
    Ok(_) -> Ok(Nil)
    Error(e) -> {
      log.error("Failed to upsert user", [
        log.str("project_id", project_id),
        log.str("anon_id", anon_id),
        log.str("user_id", user_id),
        log.str("error", format_query_error(e)),
      ])
      Error(e)
    }
  }
}
