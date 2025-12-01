/**
 * Zero Synced Queries for Beacon Dashboard
 *
 * Server-controlled queries using the new syncedQuery API.
 * These queries are validated on the server and provide type-safe data access.
 */

import { syncedQuery } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "./schema";

/**
 * Auth context for queries (null when unauthenticated)
 * Can be extended with userId, roles, etc. when auth is added
 */
export type AuthContext = {
  userId?: string;
} | null;

// ============================================
// PROJECTS
// ============================================

/**
 * Get the first project (for single-tenant development)
 */
export const firstProject = syncedQuery("firstProject", z.tuple([]), () =>
  builder.projects.limit(1),
);

/**
 * Get all projects
 */
export const allProjects = syncedQuery(
  "allProjects",
  z.tuple([]),
  () => builder.projects,
);

/**
 * Get a project by ID
 */
export const projectById = syncedQuery(
  "projectById",
  z.tuple([z.string()]),
  (projectId) => builder.projects.where("id", projectId).one(),
);

// ============================================
// EVENTS
// ============================================

/**
 * Get recent events for a project
 */
export const recentEvents = syncedQuery(
  "recentEvents",
  z.tuple([z.string(), z.number().optional()]),
  (projectId, limit = 100) =>
    builder.events
      .where("project_id", projectId)
      .orderBy("timestamp", "desc")
      .limit(limit),
);

/**
 * Get events in a time window
 */
export const eventsInWindow = syncedQuery(
  "eventsInWindow",
  z.tuple([z.string(), z.number().optional()]),
  (projectId, days = 7) => {
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
    return builder.events
      .where("project_id", projectId)
      .where("timestamp", ">=", sinceMs);
  },
);

// ============================================
// SESSIONS
// ============================================

/**
 * Get recent sessions for a project
 */
export const recentSessions = syncedQuery(
  "recentSessions",
  z.tuple([z.string(), z.number().optional()]),
  (projectId, limit = 50) =>
    builder.sessions
      .where("project_id", projectId)
      .orderBy("started_at", "desc")
      .limit(limit),
);

/**
 * Get sessions in a time window
 */
export const sessionsInWindow = syncedQuery(
  "sessionsInWindow",
  z.tuple([z.string(), z.number().optional()]),
  (projectId, days = 7) => {
    const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
    return builder.sessions
      .where("project_id", projectId)
      .where("started_at", ">=", sinceMs);
  },
);

/**
 * Get a session by ID
 */
export const sessionById = syncedQuery(
  "sessionById",
  z.tuple([z.string()]),
  (sessionId) => builder.sessions.where("id", sessionId).one(),
);

/**
 * Get events for a specific session
 */
export const eventsForSession = syncedQuery(
  "eventsForSession",
  z.tuple([z.string()]),
  (sessionId) =>
    builder.events
      .where("session_id", sessionId)
      .orderBy("timestamp", "asc")
      .limit(500),
);

// ============================================
// FLAGS
// ============================================

/**
 * Get all flags for a project
 */
export const flagsForProject = syncedQuery(
  "flagsForProject",
  z.tuple([z.string()]),
  (projectId) =>
    builder.flags.where("project_id", projectId).orderBy("key", "asc"),
);

/**
 * Get enabled flags for a project
 */
export const enabledFlags = syncedQuery(
  "enabledFlags",
  z.tuple([z.string()]),
  (projectId) =>
    builder.flags.where("project_id", projectId).where("enabled", "=", true),
);

// ============================================
// USERS
// ============================================

/**
 * Get users for a project
 */
export const usersForProject = syncedQuery(
  "usersForProject",
  z.tuple([z.string(), z.number().optional()]),
  (projectId, limit = 50) =>
    builder.users
      .where("project_id", projectId)
      .orderBy("last_seen_at", "desc")
      .limit(limit),
);

/**
 * Get identified users (those with user_id set)
 */
export const identifiedUsers = syncedQuery(
  "identifiedUsers",
  z.tuple([z.string()]),
  (projectId) =>
    builder.users.where("project_id", projectId).where("user_id", "!=", null),
);

// ============================================
// EXPORT ALL QUERIES
// ============================================

/**
 * All synced queries - used by the server endpoint
 */
export const queries = [
  firstProject,
  allProjects,
  projectById,
  recentEvents,
  eventsInWindow,
  eventsForSession,
  recentSessions,
  sessionsInWindow,
  sessionById,
  flagsForProject,
  enabledFlags,
  usersForProject,
  identifiedUsers,
] as const;
