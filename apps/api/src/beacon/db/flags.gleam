import beacon/log
import beacon/types.{type Flag, Flag}
import gleam/dict.{type Dict}
import gleam/dynamic/decode
import gleam/list
import pog

pub fn get_all_grouped(
  db: pog.Connection,
) -> Result(Dict(String, List(Flag)), pog.QueryError) {
  let row_decoder = {
    use project_id <- decode.field(0, decode.string)
    use key <- decode.field(1, decode.string)
    use enabled <- decode.field(2, decode.bool)
    decode.success(#(project_id, key, enabled))
  }

  case
    pog.query(
      "SELECT project_id, key, enabled FROM flags ORDER BY project_id, key",
    )
    |> pog.returning(row_decoder)
    |> pog.execute(db)
  {
    Ok(pog.Returned(_count, rows)) -> {
      let grouped =
        rows
        |> list.group(fn(row) { row.0 })
        |> dict.map_values(fn(_key, rows) {
          list.map(rows, fn(row) { Flag(key: row.1, enabled: row.2) })
        })
      Ok(grouped)
    }
    Error(e) -> {
      log.error("Failed to load flags from database", [])
      Error(e)
    }
  }
}

pub fn toggle(
  db: pog.Connection,
  project_id: String,
  key: String,
  enabled: Bool,
) -> Result(Nil, pog.QueryError) {
  case
    pog.query(
      "UPDATE flags SET enabled = $1, updated_at = NOW()
       WHERE project_id = $2::uuid AND key = $3",
    )
    |> pog.parameter(pog.bool(enabled))
    |> pog.parameter(pog.text(project_id))
    |> pog.parameter(pog.text(key))
    |> pog.execute(db)
  {
    Ok(_) -> Ok(Nil)
    Error(e) -> {
      log.error("Failed to toggle flag", [
        log.str("project_id", project_id),
        log.str("key", key),
      ])
      Error(e)
    }
  }
}

pub fn create(
  db: pog.Connection,
  project_id: String,
  key: String,
  name: String,
) -> Result(Nil, pog.QueryError) {
  case
    pog.query(
      "INSERT INTO flags (project_id, key, name, enabled)
       VALUES ($1::uuid, $2, $3, false)",
    )
    |> pog.parameter(pog.text(project_id))
    |> pog.parameter(pog.text(key))
    |> pog.parameter(pog.text(name))
    |> pog.execute(db)
  {
    Ok(_) -> Ok(Nil)
    Error(e) -> {
      log.error("Failed to create flag", [
        log.str("project_id", project_id),
        log.str("key", key),
      ])
      Error(e)
    }
  }
}
