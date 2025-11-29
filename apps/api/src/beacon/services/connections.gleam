import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject}
import gleam/list
import gleam/otp/actor
import gleam/result
import mist

pub type Message {
  Register(project_id: String, conn: mist.WebsocketConnection)
  Unregister(project_id: String, conn: mist.WebsocketConnection)
  Broadcast(project_id: String, payload: String)
}

pub type State {
  State(connections: Dict(String, List(mist.WebsocketConnection)))
}

/// Start the connections service actor
pub fn start() -> Result(actor.Started(Subject(Message)), actor.StartError) {
  actor.new(State(connections: dict.new()))
  |> actor.on_message(handle)
  |> actor.start
}

pub fn register(subject: Subject(Message), project_id: String, conn: mist.WebsocketConnection) -> Nil {
  process.send(subject, Register(project_id, conn))
}

pub fn unregister(subject: Subject(Message), project_id: String, conn: mist.WebsocketConnection) -> Nil {
  process.send(subject, Unregister(project_id, conn))
}

pub fn broadcast(subject: Subject(Message), project_id: String, payload: String) -> Nil {
  process.send(subject, Broadcast(project_id, payload))
}

fn handle(state: State, msg: Message) -> actor.Next(State, Message) {
  case msg {
    Register(project_id, conn) -> {
      let current =
        dict.get(state.connections, project_id)
        |> result.unwrap([])
      let updated = [conn, ..current]
      let new_conns = dict.insert(state.connections, project_id, updated)
      actor.continue(State(connections: new_conns))
    }

    Unregister(project_id, conn) -> {
      let current =
        dict.get(state.connections, project_id)
        |> result.unwrap([])
      // Note: WebsocketConnection equality may need custom handling
      let updated = list.filter(current, fn(c) { c != conn })
      let new_conns = dict.insert(state.connections, project_id, updated)
      actor.continue(State(connections: new_conns))
    }

    Broadcast(project_id, payload) -> {
      let conns =
        dict.get(state.connections, project_id)
        |> result.unwrap([])

      // Send to each connected WebSocket
      list.each(conns, fn(conn) {
        let _ = mist.send_text_frame(conn, payload)
        Nil
      })

      actor.continue(state)
    }
  }
}
