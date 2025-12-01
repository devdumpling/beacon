import beacon/db/sessions
import beacon/log
import beacon/services/connections
import beacon/services/events
import beacon/services/flags
import beacon/types.{Event}
import beacon/ws/messages.{EventMsg, IdentifyMsg, PingMsg}
import gleam/bit_array
import gleam/crypto
import gleam/erlang/process.{type Subject}
import gleam/option.{type Option, None, Some}
import mist.{type WebsocketConnection, type WebsocketMessage, Binary, Text}
import pog

pub type State {
  State(
    db: pog.Connection,
    project_id: String,
    session_id: String,
    anon_id: String,
    user_id: Option(String),
    conn_id: String,
    events_subject: Subject(events.Message),
    flags_subject: Subject(flags.Message),
    conns_subject: Subject(connections.Message),
  )
}

pub type Services {
  Services(
    db: pog.Connection,
    events: Subject(events.Message),
    flags: Subject(flags.Message),
    conns: Subject(connections.Message),
  )
}

/// Custom message type for websocket (none for now)
pub type WsMessage {
  NoMessage
}

pub fn init(
  project_id: String,
  session_id: String,
  anon_id: String,
  services: Services,
  conn: WebsocketConnection,
) -> #(State, Option(process.Selector(WsMessage))) {
  // Generate unique connection ID for proper lifecycle management
  let conn_id = uuid()

  // Register connection for flag broadcasts
  connections.register(services.conns, project_id, conn_id, conn)

  // Create or update session record in database
  case sessions.upsert(services.db, project_id, session_id, anon_id) {
    Ok(_) -> Nil
    Error(_) -> Nil
  }

  let state =
    State(
      db: services.db,
      project_id: project_id,
      session_id: session_id,
      anon_id: anon_id,
      user_id: None,
      conn_id: conn_id,
      events_subject: services.events,
      flags_subject: services.flags,
      conns_subject: services.conns,
    )

  #(state, None)
}

pub fn close(state: State) -> Nil {
  // Unregister connection using its unique ID
  connections.unregister(state.conns_subject, state.project_id, state.conn_id)
  Nil
}

pub fn handle(
  state: State,
  msg: WebsocketMessage(WsMessage),
  conn: WebsocketConnection,
) -> mist.Next(State, WsMessage) {
  case msg {
    Text(text) -> {
      case messages.parse(text) {
        Ok(EventMsg(event_name, props, ts)) -> {
          events.enqueue(
            state.events_subject,
            Event(
              project_id: state.project_id,
              session_id: state.session_id,
              anon_id: state.anon_id,
              user_id: state.user_id,
              event_name: event_name,
              properties: props,
              timestamp: ts,
            ),
          )
          // Update session event_count and last_event_at
          case sessions.touch(state.db, state.session_id) {
            Ok(_) -> Nil
            Error(_) -> Nil
          }
          mist.continue(state)
        }

        Ok(IdentifyMsg(user_id, traits)) -> {
          events.enqueue_identify(
            state.events_subject,
            state.project_id,
            state.anon_id,
            user_id,
            traits,
          )
          // Link user_id to session
          case sessions.set_user(state.db, state.session_id, user_id) {
            Ok(_) -> Nil
            Error(_) -> Nil
          }
          mist.continue(State(..state, user_id: Some(user_id)))
        }

        Ok(PingMsg) -> {
          let _ = mist.send_text_frame(conn, "{\"type\":\"pong\"}")
          mist.continue(state)
        }

        Error(_) -> {
          log.warn("Failed to parse WebSocket message", [
            log.str("session_id", state.session_id),
            log.str("raw_message", text),
          ])
          mist.continue(state)
        }
      }
    }

    Binary(_) -> mist.continue(state)

    mist.Custom(_) -> mist.continue(state)

    mist.Closed | mist.Shutdown -> mist.stop()
  }
}

/// Generate a unique connection ID using random bytes
fn uuid() -> String {
  crypto.strong_random_bytes(16)
  |> bit_array.base16_encode
}
