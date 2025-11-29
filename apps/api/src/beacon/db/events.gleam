import gleam/list
import gleam/option.{None, Some}
import pog
import beacon/types.{type Event}

pub fn insert_batch(db: pog.Connection, events: List(Event)) -> Nil {
  // Insert each event
  list.each(events, fn(event) {
    let _ =
      pog.query(
        "INSERT INTO events (project_id, session_id, anon_id, user_id, event_name, properties, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))",
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

    Nil
  })

  Nil
}

pub fn upsert_user(
  db: pog.Connection,
  project_id: String,
  anon_id: String,
  user_id: String,
  traits: String,
) -> Nil {
  let _ =
    pog.query(
      "INSERT INTO users (project_id, anon_id, user_id, traits, last_seen_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (project_id, anon_id)
       DO UPDATE SET user_id = $3, traits = $4, last_seen_at = NOW()",
    )
    |> pog.parameter(pog.text(project_id))
    |> pog.parameter(pog.text(anon_id))
    |> pog.parameter(pog.text(user_id))
    |> pog.parameter(pog.text(traits))
    |> pog.execute(db)

  Nil
}
