/**
 * PostgreSQL client for server-side queries.
 *
 * Note: Most data fetching is handled by Zero synced queries on the client.
 * This module is primarily used for auth-related queries.
 */
import postgres from "postgres";
import { DATABASE_URL } from "$env/static/private";

export const sql = postgres(DATABASE_URL);
