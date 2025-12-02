/**
 * Zero Schema for Beacon Analytics
 *
 * Defines the data model that Zero syncs from PostgreSQL.
 * Must match the database schema in infra/migrations/001_initial.sql
 *
 * Uses the new synced queries + custom mutators API (legacy disabled).
 */

import {
  createSchema,
  createBuilder,
  table,
  string,
  boolean,
  number,
  json,
  definePermissions,
  type Schema as ZeroSchema,
} from "@rocicorp/zero";

// ============================================
// TABLE DEFINITIONS
// ============================================

/**
 * Projects (multi-tenancy)
 */
const projects = table("projects")
  .columns({
    id: string(),
    name: string(),
    api_key: string(),
    created_at: number(), // TIMESTAMPTZ -> number (ms since epoch)
  })
  .primaryKey("id");

/**
 * Events (analytics events)
 * Note: This is a partitioned table in PostgreSQL with composite PK (id, received_at)
 */
const events = table("events")
  .columns({
    id: string(),
    project_id: string(),
    session_id: string(),
    anon_id: string(),
    user_id: string().optional(),
    event_name: string(),
    properties: json().optional(),
    timestamp: number(), // TIMESTAMPTZ -> number (ms since epoch)
    received_at: number(), // TIMESTAMPTZ -> number (part of composite PK)
  })
  .primaryKey("id", "received_at");

/**
 * Sessions
 */
const sessions = table("sessions")
  .columns({
    id: string(),
    project_id: string(),
    anon_id: string(),
    user_id: string().optional(),
    started_at: number(), // TIMESTAMPTZ -> number (ms since epoch)
    last_event_at: number(), // TIMESTAMPTZ -> number
    event_count: number().optional(),
    entry_url: string().optional(),
    last_url: string().optional(),
  })
  .primaryKey("id");

/**
 * Feature Flags
 */
const flags = table("flags")
  .columns({
    id: string(),
    project_id: string(),
    key: string(),
    name: string(),
    enabled: boolean(),
    created_at: number(), // TIMESTAMPTZ -> number (ms since epoch)
    updated_at: number(), // TIMESTAMPTZ -> number
  })
  .primaryKey("id");

/**
 * Users (identified users)
 */
const users = table("users")
  .columns({
    id: string(),
    project_id: string(),
    anon_id: string(),
    user_id: string().optional(),
    traits: json().optional(),
    first_seen_at: number(), // TIMESTAMPTZ -> number (ms since epoch)
    last_seen_at: number(), // TIMESTAMPTZ -> number
  })
  .primaryKey("id");

// ============================================
// SCHEMA EXPORT
// ============================================

const baseSchema = createSchema({
  tables: [projects, events, sessions, flags, users],
});

/**
 * Schema with legacy features disabled.
 * Queries go through /api/zero/get-queries
 * Mutations go through custom mutators
 */
export const schema = {
  ...baseSchema,
  enableLegacyMutators: false,
  enableLegacyQueries: false,
} as const satisfies ZeroSchema;

export type Schema = typeof schema;

/**
 * Query builder for synced queries
 */
export const builder = createBuilder(schema);

// ============================================
// PERMISSIONS (empty - handled by synced queries)
// ============================================

/**
 * Empty permissions for zero-cache-dev compatibility.
 * Actual access control is handled via synced queries and custom mutators.
 */
export const permissions = definePermissions<Record<string, never>, Schema>(
  schema,
  () => ({}),
);

// ============================================
// TABLE TYPES (manually defined)
// ============================================

/**
 * Row types for each table.
 * Manually defined since Zero's table builder doesn't have inferSelect.
 */
export interface Project {
  id: string;
  name: string;
  api_key: string;
  created_at: number;
}

export interface Event {
  id: string;
  project_id: string;
  session_id: string;
  anon_id: string;
  user_id: string | null;
  event_name: string;
  properties: Record<string, unknown> | null;
  timestamp: number;
  received_at: number;
}

export interface Session {
  id: string;
  project_id: string;
  anon_id: string;
  user_id: string | null;
  started_at: number;
  last_event_at: number;
  event_count: number | null;
  entry_url: string | null;
  last_url: string | null;
}

export interface Flag {
  id: string;
  project_id: string;
  key: string;
  name: string;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface User {
  id: string;
  project_id: string;
  anon_id: string;
  user_id: string | null;
  traits: Record<string, unknown> | null;
  first_seen_at: number;
  last_seen_at: number;
}
