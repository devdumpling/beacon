import beacon/config.{type Config}
import beacon/db/projects
import beacon/log
import beacon/services/connections
import beacon/services/events
import beacon/services/flags
import beacon/ws/handler as ws
import gleam/bytes_tree
import gleam/erlang/process.{type Subject}
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/option.{type Option, None, Some}
import gleam/result
import mist.{type Connection, type ResponseData}
import pog

pub type Services {
  Services(
    db: pog.Connection,
    events: Subject(events.Message),
    flags: Subject(flags.Message),
    conns: Subject(connections.Message),
  )
}

pub fn handler(
  _cfg: Config,
  services: Services,
) -> fn(Request(Connection)) -> Response(ResponseData) {
  fn(req: Request(Connection)) {
    case request.path_segments(req) {
      ["ws"] -> handle_websocket(req, services)
      ["health"] -> health()
      ["api", "flags", project_id] -> handle_flags_api(project_id, services)
      _ -> not_found()
    }
  }
}

fn handle_websocket(
  req: Request(Connection),
  services: Services,
) -> Response(ResponseData) {
  let query = request.get_query(req) |> result.unwrap([])

  let api_key = find_param(query, "key")
  let session_id = find_param(query, "session")
  let anon_id = find_param(query, "anon")

  case api_key, session_id, anon_id {
    Some(key), Some(s), Some(a) -> {
      // Validate API key and get project
      case projects.get_by_api_key(services.db, key) {
        Ok(Some(project)) -> {
          log.debug("WebSocket connection authenticated", [
            log.str("project_id", project.id),
          ])

          let ws_services =
            ws.Services(
              db: services.db,
              events: services.events,
              flags: services.flags,
              conns: services.conns,
            )

          mist.websocket(
            request: req,
            handler: fn(state, msg, conn) { ws.handle(state, msg, conn) },
            on_init: fn(conn) { ws.init(project.id, s, a, ws_services, conn) },
            on_close: fn(state) { ws.close(state) },
          )
        }
        Ok(None) -> {
          log.warn("Invalid API key attempted", [])
          unauthorized("Invalid API key")
        }
        Error(_) -> {
          log.error("Database error validating API key", [])
          server_error("Internal server error")
        }
      }
    }
    None, _, _ -> bad_request("Missing: key (API key)")
    _, None, _ -> bad_request("Missing: session")
    _, _, None -> bad_request("Missing: anon")
  }
}

fn handle_flags_api(
  project_id: String,
  services: Services,
) -> Response(ResponseData) {
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

fn unauthorized(msg: String) -> Response(ResponseData) {
  response.new(401)
  |> response.set_body(mist.Bytes(bytes_tree.from_string(msg)))
}

fn server_error(msg: String) -> Response(ResponseData) {
  response.new(500)
  |> response.set_body(mist.Bytes(bytes_tree.from_string(msg)))
}

fn json_response(body: String, status: Int) -> Response(ResponseData) {
  response.new(status)
  |> response.set_header("content-type", "application/json")
  |> response.set_body(mist.Bytes(bytes_tree.from_string(body)))
}
