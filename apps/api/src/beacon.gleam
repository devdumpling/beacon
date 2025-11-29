import gleam/erlang/process
import gleam/int
import gleam/io
import gleam/otp/actor
import mist
import beacon/config
import beacon/router
import beacon/db/pool
import beacon/services/events
import beacon/services/flags
import beacon/services/connections

pub fn main() {
  let cfg = config.load()

  // Initialize database pool
  let assert Ok(db) = pool.start(cfg.database_url)

  // Initialize services
  let assert Ok(actor.Started(data: conns, ..)) = connections.start()
  let assert Ok(actor.Started(data: events_subject, ..)) = events.start(db)
  let assert Ok(actor.Started(data: flags_subject, ..)) = flags.start(db, conns)

  // Load initial flag state
  flags.refresh(flags_subject)

  // Create services bundle for router
  let services = router.Services(
    events: events_subject,
    flags: flags_subject,
    conns: conns,
  )

  // Start HTTP/WebSocket server
  let assert Ok(_) =
    router.handler(cfg, services)
    |> mist.new
    |> mist.port(cfg.port)
    |> mist.start

  io.println("Beacon running on port " <> int.to_string(cfg.port))
  process.sleep_forever()
}
