import gleam/bytes_tree
import gleam/erlang/process.{type Subject}
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/option.{type Option, None, Some}
import gleam/result
import mist.{type Connection, type ResponseData}
import beacon/config.{type Config}
import beacon/ws/handler as ws
import beacon/services/events
import beacon/services/flags
import beacon/services/connections

pub type Services {
  Services(
    events: Subject(events.Message),
    flags: Subject(flags.Message),
    conns: Subject(connections.Message),
  )
}

pub fn handler(_cfg: Config, services: Services) -> fn(Request(Connection)) -> Response(ResponseData) {
  fn(req: Request(Connection)) {
    case request.path_segments(req) {
      ["ws"] -> handle_websocket(req, services)
      ["health"] -> health()
      ["api", "flags", project_id] -> handle_flags_api(project_id, services)
      _ -> not_found()
    }
  }
}

fn handle_websocket(req: Request(Connection), services: Services) -> Response(ResponseData) {
  let query = request.get_query(req) |> result.unwrap([])

  let project_id = find_param(query, "project")
  let session_id = find_param(query, "session")
  let anon_id = find_param(query, "anon")

  case project_id, session_id, anon_id {
    Some(p), Some(s), Some(a) -> {
      let ws_services = ws.Services(
        events: services.events,
        flags: services.flags,
        conns: services.conns,
      )

      mist.websocket(
        request: req,
        handler: fn(state, msg, conn) { ws.handle(state, msg, conn) },
        on_init: fn(conn) { ws.init(p, s, a, ws_services, conn) },
        on_close: fn(state) { ws.close(state) },
      )
    }
    _, _, _ -> bad_request("Missing: project, session, or anon")
  }
}

fn handle_flags_api(project_id: String, services: Services) -> Response(ResponseData) {
  // Dashboard API for flag management
  let flags_json = flags.get_json(services.flags, project_id)
  json_response(flags_json, 200)
}

fn find_param(params: List(#(String, String)), key: String) -> Option(String) {
  case params {
    [] -> None
    [#(k, v), ..] if k == key -> Some(v)
    [_, ..rest] -> find_param(rest, key)
  }
}

fn health() -> Response(ResponseData) {
  response.new(200)
  |> response.set_body(mist.Bytes(bytes_tree.from_string("ok")))
}

fn not_found() -> Response(ResponseData) {
  response.new(404)
  |> response.set_body(mist.Bytes(bytes_tree.from_string("not found")))
}

fn bad_request(msg: String) -> Response(ResponseData) {
  response.new(400)
  |> response.set_body(mist.Bytes(bytes_tree.from_string(msg)))
}

fn json_response(body: String, status: Int) -> Response(ResponseData) {
  response.new(status)
  |> response.set_header("content-type", "application/json")
  |> response.set_body(mist.Bytes(bytes_tree.from_string(body)))
}
