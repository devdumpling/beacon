import gleam/erlang/process
import gleam/option.{Some}
import gleam/otp/actor
import pog

/// Start the database connection pool
pub fn start(_database_url: String) -> Result(pog.Connection, actor.StartError) {
  // Create a named pool for the database
  let pool_name = process.new_name("beacon_db_pool")

  // TODO: Parse database_url properly
  // For now, use default local config
  let config =
    pog.default_config(pool_name)
    |> pog.host("localhost")
    |> pog.port(5432)
    |> pog.database("beacon")
    |> pog.user("beacon")
    |> pog.password(Some("beacon"))
    |> pog.pool_size(10)

  case pog.start(config) {
    Ok(actor.Started(data: conn, ..)) -> Ok(conn)
    Error(e) -> Error(e)
  }
}
