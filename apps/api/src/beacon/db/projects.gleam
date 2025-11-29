import gleam/dynamic/decode
import gleam/option.{type Option, None, Some}
import pog

/// Project record returned from database
pub type Project {
  Project(id: String, name: String, api_key: String)
}

/// Look up a project by its API key
/// Returns Some(Project) if found, None if not found or on error
pub fn get_by_api_key(
  db: pog.Connection,
  api_key: String,
) -> Result(Option(Project), pog.QueryError) {
  let row_decoder = {
    use id <- decode.field(0, decode.string)
    use name <- decode.field(1, decode.string)
    use key <- decode.field(2, decode.string)
    decode.success(Project(id: id, name: name, api_key: key))
  }

  case
    pog.query("SELECT id, name, api_key FROM projects WHERE api_key = $1")
    |> pog.parameter(pog.text(api_key))
    |> pog.returning(row_decoder)
    |> pog.execute(db)
  {
    Ok(pog.Returned(_count, [project, ..])) -> Ok(Some(project))
    Ok(pog.Returned(_count, [])) -> Ok(None)
    Error(e) -> Error(e)
  }
}

/// Get a project by its ID
pub fn get_by_id(
  db: pog.Connection,
  project_id: String,
) -> Result(Option(Project), pog.QueryError) {
  let row_decoder = {
    use id <- decode.field(0, decode.string)
    use name <- decode.field(1, decode.string)
    use key <- decode.field(2, decode.string)
    decode.success(Project(id: id, name: name, api_key: key))
  }

  case
    pog.query("SELECT id, name, api_key FROM projects WHERE id = $1::uuid")
    |> pog.parameter(pog.text(project_id))
    |> pog.returning(row_decoder)
    |> pog.execute(db)
  {
    Ok(pog.Returned(_count, [project, ..])) -> Ok(Some(project))
    Ok(pog.Returned(_count, [])) -> Ok(None)
    Error(e) -> Error(e)
  }
}

/// Create a new project
pub fn create(
  db: pog.Connection,
  name: String,
) -> Result(Project, pog.QueryError) {
  let row_decoder = {
    use id <- decode.field(0, decode.string)
    use name <- decode.field(1, decode.string)
    use key <- decode.field(2, decode.string)
    decode.success(Project(id: id, name: name, api_key: key))
  }

  case
    pog.query(
      "INSERT INTO projects (name) VALUES ($1) RETURNING id, name, api_key",
    )
    |> pog.parameter(pog.text(name))
    |> pog.returning(row_decoder)
    |> pog.execute(db)
  {
    Ok(pog.Returned(_count, [project, ..])) -> Ok(project)
    Ok(pog.Returned(_count, [])) ->
      Error(pog.UnexpectedArgumentCount(expected: 1, got: 0))
    Error(e) -> Error(e)
  }
}

/// List all projects
pub fn list_all(db: pog.Connection) -> Result(List(Project), pog.QueryError) {
  let row_decoder = {
    use id <- decode.field(0, decode.string)
    use name <- decode.field(1, decode.string)
    use key <- decode.field(2, decode.string)
    decode.success(Project(id: id, name: name, api_key: key))
  }

  case
    pog.query("SELECT id, name, api_key FROM projects ORDER BY created_at")
    |> pog.returning(row_decoder)
    |> pog.execute(db)
  {
    Ok(pog.Returned(_count, projects)) -> Ok(projects)
    Error(e) -> Error(e)
  }
}
