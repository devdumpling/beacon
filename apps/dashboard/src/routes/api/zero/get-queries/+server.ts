/**
 * Zero Synced Queries Endpoint
 *
 * Handles query requests from zero-cache.
 * Validates query arguments and returns query AST.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { withValidation, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleGetQueriesRequest } from "@rocicorp/zero/server";
import { schema } from "$lib/zero/schema";
import { queries, type AuthContext } from "$lib/zero/queries";

// Create validated query map
const validatedQueries = Object.fromEntries(
  queries.map((q) => [q.queryName, withValidation(q)])
);

export const POST: RequestHandler = async ({ request }) => {
  // For now, no auth - pass null context
  // When auth is added, extract from locals.user
  const authContext: AuthContext = null;

  // Query resolver function with auth context in closure
  function getQuery(name: string, args: readonly unknown[]) {
    const query = validatedQueries[name];
    if (!query) {
      throw new Error(`No such query: ${name}`);
    }

    return {
      query: query(authContext, ...(args as readonly ReadonlyJSONValue[])),
    };
  }

  const result = await handleGetQueriesRequest(getQuery, schema, request);
  return json(result);
};
