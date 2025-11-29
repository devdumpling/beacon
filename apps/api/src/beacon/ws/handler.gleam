import gleam/dynamic/decode
import gleam/erlang/process.{type Subject}
import gleam/json
import gleam/option.{type Option, None, Some}
import mist.{type WebsocketConnection, type WebsocketMessage, Binary, Text}
import beacon/services/events
import beacon/services/flags
import beacon/services/connections
import beacon/types.{Event}

pub type State {
  State(
    project_id: String,
    session_id: String,
    anon_id: String,
    user_id: Option(String),
    events_subject: Subject(events.Message),
    flags_subject: Subject(flags.Message),
    conns_subject: Subject(connections.Message),
  )
}

pub type Services {
  Services(
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
  // Register connection for flag broadcasts
  connections.register(services.conns, project_id, conn)

  let state = State(
    project_id: project_id,
    session_id: session_id,
    anon_id: anon_id,
    user_id: None,
    events_subject: services.events,
    flags_subject: services.flags,
    conns_subject: services.conns,
  )

  #(state, None)
}

pub fn close(_state: State) -> Nil {
  // Note: We don't have access to conn in on_close
  // The connection is managed by mist internally
  Nil
}

pub fn handle(
  state: State,
  msg: WebsocketMessage(WsMessage),
  conn: WebsocketConnection,
) -> mist.Next(State, WsMessage) {
  case msg {
    Text(text) -> {
      case parse_message(text) {
        Ok(EventMsg(event_name, props, ts)) -> {
          events.enqueue(state.events_subject, Event(
            project_id: state.project_id,
            session_id: state.session_id,
            anon_id: state.anon_id,
            user_id: state.user_id,
            event_name: event_name,
            properties: props,
            timestamp: ts,
          ))
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
          mist.continue(State(..state, user_id: Some(user_id)))
        }

        Ok(PingMsg) -> {
          let _ = mist.send_text_frame(conn, "{\"type\":\"pong\"}")
          mist.continue(state)
        }

        Error(_) -> mist.continue(state)
      }
    }

    Binary(_) -> mist.continue(state)

    mist.Custom(_) -> mist.continue(state)

    mist.Closed | mist.Shutdown -> mist.stop()
  }
}

type ParsedMessage {
  EventMsg(event_name: String, properties: String, timestamp: Int)
  IdentifyMsg(user_id: String, traits: String)
  PingMsg
}

fn parse_message(text: String) -> Result(ParsedMessage, Nil) {
  // First decode the type field
  let type_decoder = {
    use msg_type <- decode.field("type", decode.string)
    decode.success(msg_type)
  }

  case json.parse(text, type_decoder) {
    Ok("event") -> parse_event(text)
    Ok("identify") -> parse_identify(text)
    Ok("ping") -> Ok(PingMsg)
    _ -> Error(Nil)
  }
}

fn parse_event(text: String) -> Result(ParsedMessage, Nil) {
  let decoder = {
    use event_name <- decode.optional_field("event", "", decode.string)
    use props <- decode.optional_field("props", "{}", decode.string)
    use ts <- decode.optional_field("ts", 0, decode.int)
    decode.success(EventMsg(event_name, props, ts))
  }

  case json.parse(text, decoder) {
    Ok(msg) -> Ok(msg)
    Error(_) -> Error(Nil)
  }
}

fn parse_identify(text: String) -> Result(ParsedMessage, Nil) {
  let decoder = {
    use user_id <- decode.field("userId", decode.string)
    use traits <- decode.optional_field("traits", "{}", decode.string)
    decode.success(IdentifyMsg(user_id, traits))
  }

  case json.parse(text, decoder) {
    Ok(msg) -> Ok(msg)
    Error(_) -> Error(Nil)
  }
}
