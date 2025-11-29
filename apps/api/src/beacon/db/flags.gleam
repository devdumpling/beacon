import gleam/dict.{type Dict}
import gleam/dynamic/decode
import gleam/list
import pog
import beacon/types.{type Flag, Flag}

pub fn get_all_grouped(db: pog.Connection) -> Dict(String, List(Flag)) {
  let row_decoder = {
    use project_id <- decode.field(0, decode.string)
    use key <- decode.field(1, decode.string)
    use enabled <- decode.field(2, decode.bool)
    decode.success(#(project_id, key, enabled))
  }

  let result =
    pog.query("SELECT project_id, key, enabled FROM flags ORDER BY project_id, key")
    |> pog.returning(row_decoder)
    |> pog.execute(db)

  case result {
    Ok(pog.Returned(_count, rows)) -> {
      rows
      |> list.group(fn(row) { row.0 })
      |> dict.map_values(fn(_key, rows) {
        list.map(rows, fn(row) { Flag(key: row.1, enabled: row.2) })
      })
    }
    Error(_) -> dict.new()
  }
}

pub fn toggle(db: pog.Connection, project_id: String, key: String, enabled: Bool) -> Nil {
  let _ =
    pog.query(
      "UPDATE flags SET enabled = $1, updated_at = NOW()
       WHERE project_id = $2 AND key = $3",
    )
    |> pog.parameter(pog.bool(enabled))
    |> pog.parameter(pog.text(project_id))
    |> pog.parameter(pog.text(key))
    |> pog.execute(db)

  Nil
}

pub fn create(db: pog.Connection, project_id: String, key: String, name: String) -> Nil {
  let _ =
    pog.query(
      "INSERT INTO flags (project_id, key, name, enabled)
       VALUES ($1, $2, $3, false)",
    )
    |> pog.parameter(pog.text(project_id))
    |> pog.parameter(pog.text(key))
    |> pog.parameter(pog.text(name))
    |> pog.execute(db)

  Nil
}
