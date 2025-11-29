import gleam/erlang/process
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/result
import gleam/string
import gleam/uri
import pog

/// Parsed database connection configuration
pub type DbConfig {
  DbConfig(
    host: String,
    port: Int,
    database: String,
    user: String,
    password: Option(String),
  )
}

/// Parse a postgres:// URL into DbConfig
/// Format: postgres://user:password@host:port/database?sslmode=disable
pub fn parse_url(database_url: String) -> Result(DbConfig, String) {
  use parsed <- result.try(
    uri.parse(database_url)
    |> result.replace_error("Invalid database URL format"),
  )

  // Extract host
  use host <- result.try(
    parsed.host
    |> option.to_result("Missing host in database URL"),
  )

  // Extract port (default 5432)
  let port = parsed.port |> option.unwrap(5432)

  // Extract database from path (remove leading /)
  let database = case parsed.path {
    "/" <> db -> db
    db -> db
  }
  use _ <- result.try(case database {
    "" -> Error("Missing database name in URL")
    _ -> Ok(Nil)
  })

  // Parse userinfo (user:password)
  use #(user, password) <- result.try(parse_userinfo(parsed.userinfo))

  Ok(DbConfig(
    host: host,
    port: port,
    database: database,
    user: user,
    password: password,
  ))
}

fn parse_userinfo(
  userinfo: Option(String),
) -> Result(#(String, Option(String)), String) {
  case userinfo {
    None -> Error("Missing user credentials in database URL")
    Some(info) -> {
      case string.split(info, ":") {
        [user] -> Ok(#(user, None))
        [user, pass] -> Ok(#(user, Some(pass)))
        _ -> Error("Invalid userinfo format in database URL")
      }
    }
  }
}

/// Start the database connection pool
pub fn start(database_url: String) -> Result(pog.Connection, actor.StartError) {
  // Parse the database URL
  let db_config = case parse_url(database_url) {
    Ok(cfg) -> cfg
    Error(_msg) -> {
      // Fall back to defaults for local development
      // TODO: Log warning about invalid URL
      DbConfig(
        host: "localhost",
        port: 5432,
        database: "beacon",
        user: "beacon",
        password: Some("beacon"),
      )
    }
  }

  // Create a named pool for the database
  let pool_name = process.new_name("beacon_db_pool")

  let config =
    pog.default_config(pool_name)
    |> pog.host(db_config.host)
    |> pog.port(db_config.port)
    |> pog.database(db_config.database)
    |> pog.user(db_config.user)
    |> pog.password(db_config.password)
    |> pog.pool_size(10)

  case pog.start(config) {
    Ok(actor.Started(data: conn, ..)) -> Ok(conn)
    Error(e) -> Error(e)
  }
}
