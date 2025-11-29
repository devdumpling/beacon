import beacon/config
import beacon/db/pool
import beacon/log
import beacon/router
import beacon/services/connections
import beacon/services/events
import beacon/services/flags
import gleam/erlang/process
import gleam/otp/actor
import gleam/string
import mist
import pog

pub fn main() {
  log.info("Starting Beacon API", [])

  let cfg = config.load()

  // Initialize database pool
  case pool.start(cfg.database_url) {
    Ok(db) -> {
      log.info("Database pool initialized", [])
      start_services(cfg, db)
    }
    Error(_err) -> {
      log.error("Failed to connect to database", [
        log.str("url", mask_password(cfg.database_url)),
      ])
      panic as "Database connection failed"
    }
  }
}

fn start_services(cfg: config.Config, db: pog.Connection) -> Nil {
  // Initialize connections service
  case connections.start() {
    Ok(actor.Started(data: conns, ..)) -> {
      log.debug("Connections service started", [])

      // Initialize events service
      case events.start(db) {
        Ok(actor.Started(data: events_subject, ..)) -> {
          log.debug("Events service started", [])

          // Initialize flags service
          case flags.start(db, conns) {
            Ok(actor.Started(data: flags_subject, ..)) -> {
              log.debug("Flags service started", [])

              // Load initial flag state
              flags.refresh(flags_subject)

              // Create services bundle for router
              let services =
                router.Services(
                  db: db,
                  events: events_subject,
                  flags: flags_subject,
                  conns: conns,
                )

              start_server(cfg, services)
            }
            Error(_) -> {
              log.error("Failed to start flags service", [])
              panic as "Flags service failed to start"
            }
          }
        }
        Error(_) -> {
          log.error("Failed to start events service", [])
          panic as "Events service failed to start"
        }
      }
    }
    Error(_) -> {
      log.error("Failed to start connections service", [])
      panic as "Connections service failed to start"
    }
  }
}

fn start_server(cfg: config.Config, services: router.Services) -> Nil {
  case
    router.handler(cfg, services)
    |> mist.new
    |> mist.port(cfg.port)
    |> mist.start
  {
    Ok(_) -> {
      log.info("Server started", [log.int("port", cfg.port)])
      process.sleep_forever()
    }
    Error(_) -> {
      log.error("Failed to start HTTP server", [log.int("port", cfg.port)])
      panic as "HTTP server failed to start"
    }
  }
}

/// Mask password in database URL for safe logging
/// postgres://user:password@host -> postgres://user:***@host
fn mask_password(url: String) -> String {
  case string.contains(url, "@") {
    True -> {
      // Find :// and @, mask between first : after :// and @
      case string.split_once(url, "://") {
        Ok(#(scheme, rest)) -> {
          case string.split_once(rest, "@") {
            Ok(#(userinfo, host)) -> {
              case string.split_once(userinfo, ":") {
                Ok(#(user, _password)) ->
                  scheme <> "://" <> user <> ":***@" <> host
                Error(_) -> url
              }
            }
            Error(_) -> url
          }
        }
        Error(_) -> url
      }
    }
    False -> url
  }
}
