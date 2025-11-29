import gleam/erlang/process.{type Subject}
import gleam/list
import gleam/otp/actor
import pog
import beacon/types.{type Event}
import beacon/db/events as events_db

pub type Message {
  Enqueue(Event)
  EnqueueIdentify(project_id: String, anon_id: String, user_id: String, traits: String)
  Flush
}

pub type State {
  State(events: List(Event), count: Int, self: Subject(Message), db: pog.Connection)
}

const batch_size = 100

const flush_ms = 5000

/// Start the events service actor
pub fn start(db: pog.Connection) -> Result(actor.Started(Subject(Message)), actor.StartError) {
  actor.new_with_initialiser(1000, fn(self) {
    schedule_flush(self)
    Ok(
      actor.initialised(State(events: [], count: 0, self: self, db: db))
      |> actor.returning(self)
    )
  })
  |> actor.on_message(handle)
  |> actor.start
}

pub fn enqueue(subject: Subject(Message), event: Event) -> Nil {
  process.send(subject, Enqueue(event))
}

pub fn enqueue_identify(
  subject: Subject(Message),
  project_id: String,
  anon_id: String,
  user_id: String,
  traits: String,
) -> Nil {
  process.send(subject, EnqueueIdentify(project_id, anon_id, user_id, traits))
}

fn handle(state: State, msg: Message) -> actor.Next(State, Message) {
  case msg {
    Enqueue(event) -> {
      let new_events = [event, ..state.events]
      let new_count = state.count + 1

      case new_count >= batch_size {
        True -> {
          flush_events(state.db, new_events)
          actor.continue(State(..state, events: [], count: 0))
        }
        False -> actor.continue(State(..state, events: new_events, count: new_count))
      }
    }

    EnqueueIdentify(project_id, anon_id, user_id, traits) -> {
      events_db.upsert_user(state.db, project_id, anon_id, user_id, traits)
      actor.continue(state)
    }

    Flush -> {
      case state.events {
        [] -> Nil
        events -> flush_events(state.db, events)
      }
      schedule_flush(state.self)
      actor.continue(State(..state, events: [], count: 0))
    }
  }
}

fn flush_events(db: pog.Connection, events: List(Event)) -> Nil {
  events_db.insert_batch(db, list.reverse(events))
}

fn schedule_flush(subj: Subject(Message)) -> Nil {
  process.send_after(subj, flush_ms, Flush)
  Nil
}
