import beacon/ws/messages.{EventMsg, IdentifyMsg, PingMsg}
import gleeunit/should

// ─────────────────────────────────────────────────────────────
// Event message parsing
// ─────────────────────────────────────────────────────────────

pub fn parse_event_full_test() {
  let json =
    "{\"type\":\"event\",\"event\":\"button_click\",\"props\":\"{\\\"id\\\":\\\"123\\\"}\",\"ts\":1700000000000}"

  messages.parse(json)
  |> should.be_ok
  |> should.equal(EventMsg(
    "button_click",
    "{\"id\":\"123\"}",
    1_700_000_000_000,
  ))
}

pub fn parse_event_minimal_test() {
  let json = "{\"type\":\"event\"}"

  messages.parse(json)
  |> should.be_ok
  |> should.equal(EventMsg("", "{}", 0))
}

pub fn parse_event_with_empty_props_test() {
  let json =
    "{\"type\":\"event\",\"event\":\"page_view\",\"props\":\"{}\",\"ts\":123}"

  messages.parse(json)
  |> should.be_ok
  |> should.equal(EventMsg("page_view", "{}", 123))
}

// ─────────────────────────────────────────────────────────────
// Identify message parsing
// ─────────────────────────────────────────────────────────────

pub fn parse_identify_full_test() {
  let json =
    "{\"type\":\"identify\",\"userId\":\"user-123\",\"traits\":\"{\\\"name\\\":\\\"Jane\\\"}\"}"

  messages.parse(json)
  |> should.be_ok
  |> should.equal(IdentifyMsg("user-123", "{\"name\":\"Jane\"}"))
}

pub fn parse_identify_minimal_test() {
  let json = "{\"type\":\"identify\",\"userId\":\"user-456\"}"

  messages.parse(json)
  |> should.be_ok
  |> should.equal(IdentifyMsg("user-456", "{}"))
}

pub fn parse_identify_missing_userid_test() {
  let json = "{\"type\":\"identify\",\"traits\":\"{\\\"foo\\\":\\\"bar\\\"}\"}"

  messages.parse(json)
  |> should.be_error
}

// ─────────────────────────────────────────────────────────────
// Ping message parsing
// ─────────────────────────────────────────────────────────────

pub fn parse_ping_test() {
  let json = "{\"type\":\"ping\"}"

  messages.parse(json)
  |> should.be_ok
  |> should.equal(PingMsg)
}

pub fn parse_ping_with_extra_fields_test() {
  let json = "{\"type\":\"ping\",\"extra\":\"ignored\"}"

  messages.parse(json)
  |> should.be_ok
  |> should.equal(PingMsg)
}

// ─────────────────────────────────────────────────────────────
// Invalid message handling
// ─────────────────────────────────────────────────────────────

pub fn parse_unknown_type_test() {
  let json = "{\"type\":\"unknown\"}"

  messages.parse(json)
  |> should.be_error
}

pub fn parse_missing_type_test() {
  let json = "{\"event\":\"click\"}"

  messages.parse(json)
  |> should.be_error
}

pub fn parse_malformed_json_test() {
  let json = "not valid json"

  messages.parse(json)
  |> should.be_error
}

pub fn parse_empty_string_test() {
  let json = ""

  messages.parse(json)
  |> should.be_error
}

pub fn parse_empty_object_test() {
  let json = "{}"

  messages.parse(json)
  |> should.be_error
}

pub fn parse_null_type_test() {
  let json = "{\"type\":null}"

  messages.parse(json)
  |> should.be_error
}

pub fn parse_numeric_type_test() {
  let json = "{\"type\":123}"

  messages.parse(json)
  |> should.be_error
}
