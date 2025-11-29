import gleam/dict.{type Dict}
import gleam/erlang/process.{type Subject}
import gleam/list
import gleam/otp/actor
import gleam/result
import mist

/// Connection with unique ID for proper lifecycle management
pub type Connection {
  Connection(id: String, conn: mist.WebsocketConnection)
}

pub type Message {
  Register(project_id: String, conn_id: String, conn: mist.WebsocketConnection)
  Unregister(project_id: String, conn_id: String)
  Broadcast(project_id: String, payload: String)
}

pub type State {
  State(connections: Dict(String, List(Connection)))
}

/// Start the connections service actor
pub fn start() -> Result(actor.Started(Subject(Message)), actor.StartError) {
  actor.new(State(connections: dict.new()))
  |> actor.on_message(handle)
  |> actor.start
}

pub fn register(subject: Subject(Message), project_id: String, conn_id: String, conn: mist.WebsocketConnection) -> Nil {
  process.send(subject, Register(project_id, conn_id, conn))
}

pub fn unregister(subject: Subject(Message), project_id: String, conn_id: String) -> Nil {
  process.send(subject, Unregister(project_id, conn_id))
}

pub fn broadcast(subject: Subject(Message), project_id: String, payload: String) -> Nil {
  process.send(subject, Broadcast(project_id, payload))
}

fn handle(state: State, msg: Message) -> actor.Next(State, Message) {
  case msg {
    Register(project_id, conn_id, conn) -> {
      let current =
        dict.get(state.connections, project_id)
        |> result.unwrap([])
      let updated = [Connection(id: conn_id, conn: conn), ..current]
      let new_conns = dict.insert(state.connections, project_id, updated)
      actor.continue(State(connections: new_conns))
    }

    Unregister(project_id, conn_id) -> {
      let current =
        dict.get(state.connections, project_id)
        |> result.unwrap([])
      // Filter by connection ID (string equality is reliable)
      let updated = list.filter(current, fn(c) { c.id != conn_id })
      let new_conns = dict.insert(state.connections, project_id, updated)
      actor.continue(State(connections: new_conns))
    }

    Broadcast(project_id, payload) -> {
      let conns =
        dict.get(state.connections, project_id)
        |> result.unwrap([])

      // Send to each connected WebSocket, filtering out dead connections
      let live_conns = list.filter(conns, fn(c) {
        case mist.send_text_frame(c.conn, payload) {
          Ok(_) -> True
          Error(_) -> False
        }
      })

      // Update state with only live connections
      let new_conns = dict.insert(state.connections, project_id, live_conns)
      actor.continue(State(connections: new_conns))
    }
  }
}
