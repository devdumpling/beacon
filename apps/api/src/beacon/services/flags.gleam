import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject}
import gleam/json
import gleam/list
import gleam/otp/actor
import gleam/result
import pog
import beacon/db/flags as flags_db
import beacon/services/connections
import beacon/types.{type Flag, Flag}

pub type Message {
  Get(project_id: String, reply: Subject(List(Flag)))
  GetJson(project_id: String, reply: Subject(String))
  Refresh
  Toggle(project_id: String, key: String, enabled: Bool)
}

pub type State {
  State(flags: Dict(String, List(Flag)), db: pog.Connection, conns: Subject(connections.Message))
}

/// Start the flags service actor
pub fn start(db: pog.Connection, conns: Subject(connections.Message)) -> Result(actor.Started(Subject(Message)), actor.StartError) {
  actor.new(State(flags: dict.new(), db: db, conns: conns))
  |> actor.on_message(handle)
  |> actor.start
}

pub fn refresh(subject: Subject(Message)) -> Nil {
  process.send(subject, Refresh)
}

pub fn get(subject: Subject(Message), project_id: String) -> List(Flag) {
  process.call(subject, 1000, fn(reply) { Get(project_id, reply) })
}

pub fn get_json(subject: Subject(Message), project_id: String) -> String {
  process.call(subject, 1000, fn(reply) { GetJson(project_id, reply) })
}

pub fn toggle(subject: Subject(Message), project_id: String, key: String, enabled: Bool) -> Nil {
  process.send(subject, Toggle(project_id, key, enabled))
}

fn handle(state: State, msg: Message) -> actor.Next(State, Message) {
  case msg {
    Get(project_id, reply) -> {
      let flags =
        dict.get(state.flags, project_id)
        |> result.unwrap([])
      process.send(reply, flags)
      actor.continue(state)
    }

    GetJson(project_id, reply) -> {
      let flags =
        dict.get(state.flags, project_id)
        |> result.unwrap([])
      let json_str = flags_to_json(flags)
      process.send(reply, json_str)
      actor.continue(state)
    }

    Refresh -> {
      case flags_db.get_all_grouped(state.db) {
        Ok(flags) -> actor.continue(State(..state, flags: flags))
        Error(_) -> {
          // Error already logged in db module, keep existing state
          actor.continue(state)
        }
      }
    }

    Toggle(project_id, key, enabled) -> {
      // Update in DB (error logged in db module)
      case flags_db.toggle(state.db, project_id, key, enabled) {
        Ok(_) -> {
          // Update cache
          let project_flags =
            dict.get(state.flags, project_id)
            |> result.unwrap([])
          let updated =
            list.map(project_flags, fn(f) {
              case f.key == key {
                True -> Flag(..f, enabled: enabled)
                False -> f
              }
            })
          let new_flags = dict.insert(state.flags, project_id, updated)

          // Broadcast to connected clients
          connections.broadcast(state.conns, project_id, flags_to_json(updated))

          actor.continue(State(..state, flags: new_flags))
        }
        Error(_) -> {
          // Error already logged in db module, keep existing state
          actor.continue(state)
        }
      }
    }
  }
}

fn flags_to_json(flags: List(Flag)) -> String {
  let flag_pairs =
    list.map(flags, fn(f) { #(f.key, json.bool(f.enabled)) })

  json.object([#("type", json.string("flags")), #("flags", json.object(flag_pairs))])
  |> json.to_string
}
