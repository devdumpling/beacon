import gleam/option.{type Option}

pub type Event {
  Event(
    project_id: String,
    session_id: String,
    anon_id: String,
    user_id: Option(String),
    event_name: String,
    properties: String,
    timestamp: Int,
  )
}

pub type Flag {
  Flag(key: String, enabled: Bool)
}
