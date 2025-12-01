/**
 * Zero Client Wrapper for Svelte 5
 *
 * Provides ergonomic reactive hooks for Zero synced queries in Svelte.
 * Handles subscription lifecycle and cleanup automatically.
 *
 * Uses Svelte context for proper component tree integration.
 *
 * ## Reactive Parameters
 *
 * Query hooks support both static queries and getter functions for reactive params.
 * Use getter functions when query parameters depend on reactive state:
 *
 * ```typescript
 * // Static - query params never change
 * const events = useQuery(recentEvents('project-123', 100));
 *
 * // Reactive - re-runs when `days` state changes
 * let days = $state(7);
 * const events = useQuery(() => eventsInWindow(projectId, days));
 * ```
 *
 * Why getter functions? Svelte 5's `$effect` only tracks reactive values that are
 * **synchronously read** during execution. By passing a getter, the function is
 * called inside the effect, allowing Svelte to track dependencies like `days`.
 * Without this, the query would capture `days = 7` at mount time and never update.
 */

import { schema, type Schema } from "./schema";
import { createMutators, type Mutators } from "./mutators";
import { Zero, type Query } from "@rocicorp/zero";
import { getContext, setContext, untrack } from "svelte";

// Use string key instead of Symbol for HMR stability (Symbols are unique per module load)
const ZERO_KEY = "__zero_client__";

export type ZeroClient = Zero<Schema, Mutators>;

// Module-level fallback for HMR scenarios where context may be lost
let _zeroInstance: ZeroClient | null = null;

/**
 * Initialize Zero client and set it in Svelte context.
 * Call this once in your root layout (client-side only).
 * Idempotent - returns existing instance if already created.
 *
 * @param userID - Unique identifier for the current user (use 'dashboard-admin' for admin)
 * @param server - Zero cache server URL (default: http://localhost:4848)
 * @returns Zero client instance
 */
export function createZero(
  userID: string = "dashboard-admin",
  server: string = "http://localhost:4848",
): ZeroClient {
  // Return existing instance if already initialized (idempotent)
  if (_zeroInstance) {
    return _zeroInstance;
  }

  const zero = new Zero<Schema, Mutators>({
    server,
    schema,
    userID,
    mutators: createMutators(),
  });

  // Store at module level for HMR resilience
  _zeroInstance = zero;
  setContext(ZERO_KEY, zero);
  return zero;
}

/**
 * Get Zero client from Svelte context.
 * Must be called after createZero() in a parent component.
 * Falls back to module-level instance for HMR resilience.
 */
export function getZero(): ZeroClient {
  // Try context first, fall back to module-level instance for HMR
  const zero = getContext<ZeroClient>(ZERO_KEY) ?? _zeroInstance;
  if (!zero) {
    throw new Error(
      "Zero not initialized. Call createZero() in +layout.svelte first.",
    );
  }
  return zero;
}

/**
 * Reactive query result wrapper.
 */
export interface QueryResult<T> {
  /** Query results (empty array while loading) */
  readonly data: T[];
  /** Whether the query is still loading initial data */
  readonly loading: boolean;
}

/**
 * Query input type - either a query object or a getter function for reactive params.
 */
type QueryInput<TTable extends keyof Schema["tables"] & string, TReturn> =
  | Query<Schema, TTable, TReturn>
  | (() => Query<Schema, TTable, TReturn>);

/**
 * Create a reactive query that automatically updates when data changes.
 * Handles subscription lifecycle and cleanup automatically.
 *
 * Works with synced queries. Pass either a query directly or a getter function
 * for reactive parameters:
 *
 * @example
 * ```svelte
 * <script>
 *   import { useQuery } from '$lib/zero/client.svelte';
 *   import { recentEvents } from '$lib/zero/queries';
 *
 *   // Static query (no reactive params):
 *   const events = useQuery(recentEvents('project-123', 100));
 *
 *   // Reactive query (re-runs when projectId or limit changes):
 *   const events = useQuery(() => recentEvents(projectId, limit));
 * </script>
 *
 * {#each events.data as event}
 *   <div>{event.event_name}</div>
 * {/each}
 * ```
 */
export function useQuery<
  TTable extends keyof Schema["tables"] & string,
  TReturn,
>(queryInput: QueryInput<TTable, TReturn>): QueryResult<TReturn> {
  const zero = getZero();

  let data = $state<TReturn[]>([]);
  let loading = $state(true);

  $effect(() => {
    // Resolve query - call getter if function, otherwise use directly
    // This makes reactive dependencies work when using getter form
    const query =
      typeof queryInput === "function" ? queryInput() : queryInput;

    // Materialize the query (returns a View)
    const view = zero.materialize(query);

    // Subscribe to updates
    const unsubscribe = view.addListener((results) => {
      data = Array.isArray(results)
        ? ([...results] as TReturn[])
        : (results as unknown as TReturn[]);
      loading = false;
    });

    // Load initial data
    untrack(() => {
      zero.run(query).then((initialData) => {
        data = Array.isArray(initialData)
          ? ([...initialData] as TReturn[])
          : (initialData as unknown as TReturn[]);
        loading = false;
      });
    });

    // Cleanup when component unmounts or query changes
    return () => {
      unsubscribe();
    };
  });

  return {
    get data() {
      return data;
    },
    get loading() {
      return loading;
    },
  };
}

/**
 * Reactive single-item query result wrapper.
 */
export interface QueryOneResult<T> {
  /** Query result (undefined while loading or if not found) */
  readonly data: T | undefined;
  /** Whether the query is still loading initial data */
  readonly loading: boolean;
}

/**
 * Create a reactive query that returns a single item.
 * Similar to useQuery but expects .one() query results.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useQueryOne } from '$lib/zero/client.svelte';
 *   import { projectById } from '$lib/zero/queries';
 *
 *   // Static query:
 *   const project = useQueryOne(projectById('project-123'));
 *
 *   // Reactive query (re-runs when projectId changes):
 *   const project = useQueryOne(() => projectById(projectId));
 * </script>
 *
 * {#if project.data}
 *   <h1>{project.data.name}</h1>
 * {/if}
 * ```
 */
export function useQueryOne<
  TTable extends keyof Schema["tables"] & string,
  TReturn,
>(queryInput: QueryInput<TTable, TReturn>): QueryOneResult<TReturn> {
  const zero = getZero();

  let data = $state<TReturn | undefined>(undefined);
  let loading = $state(true);

  $effect(() => {
    // Resolve query - call getter if function, otherwise use directly
    const query =
      typeof queryInput === "function" ? queryInput() : queryInput;

    const view = zero.materialize(query);

    const unsubscribe = view.addListener((result) => {
      data = result as TReturn | undefined;
      loading = false;
    });

    untrack(() => {
      zero.run(query).then((initialData) => {
        data = initialData as TReturn | undefined;
        loading = false;
      });
    });

    return () => {
      unsubscribe();
    };
  });

  return {
    get data() {
      return data;
    },
    get loading() {
      return loading;
    },
  };
}
