/// WebSocket message parsing
///
/// Handles parsing of incoming WebSocket messages from clients.
/// Messages are JSON with a "type" field that determines the message kind.
import gleam/dynamic/decode
import gleam/json

/// Parsed message types that the WebSocket handler can process
pub type ParsedMessage {
  EventMsg(event_name: String, properties: String, timestamp: Int)
  IdentifyMsg(user_id: String, traits: String)
  PingMsg
}

/// Parse a WebSocket text message into a typed message
/// Returns Error(Nil) for invalid/unknown messages
pub fn parse(text: String) -> Result(ParsedMessage, Nil) {
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
