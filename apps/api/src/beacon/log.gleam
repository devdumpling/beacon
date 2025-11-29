/// Structured logging module for Beacon API
///
/// Outputs JSON-formatted logs for easy parsing by log aggregators.
/// Log levels: debug, info, warn, error

import gleam/io
import gleam/json
import gleam/list
import gleam/option.{type Option, None, Some}

pub type Level {
  Debug
  Info
  Warn
  Error
}

pub type Field {
  Field(key: String, value: FieldValue)
}

pub type FieldValue {
  StringVal(String)
  IntVal(Int)
  BoolVal(Bool)
}

/// Log a debug message
pub fn debug(msg: String, fields: List(Field)) -> Nil {
  log(Debug, msg, fields)
}

/// Log an info message
pub fn info(msg: String, fields: List(Field)) -> Nil {
  log(Info, msg, fields)
}

/// Log a warning message
pub fn warn(msg: String, fields: List(Field)) -> Nil {
  log(Warn, msg, fields)
}

/// Log an error message
pub fn error(msg: String, fields: List(Field)) -> Nil {
  log(Error, msg, fields)
}

/// Log an error with an associated error value
pub fn error_with(msg: String, err: String, fields: List(Field)) -> Nil {
  log(Error, msg, [Field("error", StringVal(err)), ..fields])
}

/// Create a string field
pub fn str(key: String, value: String) -> Field {
  Field(key, StringVal(value))
}

/// Create an int field
pub fn int(key: String, value: Int) -> Field {
  Field(key, IntVal(value))
}

/// Create a bool field
pub fn bool(key: String, value: Bool) -> Field {
  Field(key, BoolVal(value))
}

/// Create an optional string field (skipped if None)
pub fn maybe_str(key: String, value: Option(String)) -> Option(Field) {
  case value {
    Some(v) -> Some(Field(key, StringVal(v)))
    None -> None
  }
}

fn log(level: Level, msg: String, fields: List(Field)) -> Nil {
  let level_str = case level {
    Debug -> "debug"
    Info -> "info"
    Warn -> "warn"
    Error -> "error"
  }

  let base_fields = [
    #("level", json.string(level_str)),
    #("msg", json.string(msg)),
  ]

  let extra_fields = list.map(fields, fn(f) {
    let Field(key, value) = f
    case value {
      StringVal(s) -> #(key, json.string(s))
      IntVal(i) -> #(key, json.int(i))
      BoolVal(b) -> #(key, json.bool(b))
    }
  })

  let all_fields = list.append(base_fields, extra_fields)

  json.object(all_fields)
  |> json.to_string
  |> io.println
}
