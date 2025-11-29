import beacon/db/pool.{DbConfig, parse_url}
import gleam/option.{None, Some}
import gleeunit/should

pub fn parse_url_full_test() {
  let url = "postgres://beacon:beacon@localhost:5432/beacon?sslmode=disable"

  parse_url(url)
  |> should.be_ok
  |> should.equal(DbConfig(
    host: "localhost",
    port: 5432,
    database: "beacon",
    user: "beacon",
    password: Some("beacon"),
  ))
}

pub fn parse_url_no_password_test() {
  let url = "postgres://admin@db.example.com:5433/mydb"

  parse_url(url)
  |> should.be_ok
  |> should.equal(DbConfig(
    host: "db.example.com",
    port: 5433,
    database: "mydb",
    user: "admin",
    password: None,
  ))
}

pub fn parse_url_default_port_test() {
  let url = "postgres://user:pass@host/database"

  parse_url(url)
  |> should.be_ok
  |> should.equal(DbConfig(
    host: "host",
    port: 5432,
    // Default PostgreSQL port
    database: "database",
    user: "user",
    password: Some("pass"),
  ))
}

pub fn parse_url_missing_database_test() {
  let url = "postgres://user:pass@localhost:5432"

  parse_url(url)
  |> should.be_error
}

pub fn parse_url_missing_user_test() {
  let url = "postgres://localhost:5432/beacon"

  parse_url(url)
  |> should.be_error
}

pub fn parse_url_invalid_format_test() {
  let url = "not a valid url"

  parse_url(url)
  |> should.be_error
}
