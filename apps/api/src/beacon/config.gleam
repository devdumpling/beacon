import envoy
import gleam/int
import gleam/result

pub type Config {
  Config(port: Int, database_url: String)
}

pub fn load() -> Config {
  let port =
    envoy.get("PORT")
    |> result.try(int.parse)
    |> result.unwrap(4000)

  let database_url =
    envoy.get("DATABASE_URL")
    |> result.unwrap("postgres://beacon:beacon@localhost:5432/beacon")

  Config(port: port, database_url: database_url)
}
