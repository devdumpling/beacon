/**
 * Zero Client Wrapper for Svelte 5
 *
 * Provides ergonomic reactive hooks for Zero synced queries in Svelte.
 * Handles subscription lifecycle and cleanup automatically.
 */

import { schema, type Schema } from "./schema";
import { Zero } from "@rocicorp/zero";
import { getContext, setContext, untrack } from "svelte";

const ZERO_KEY = Symbol("zero");

export type ZeroClient = Zero<Schema>;

/**
 * Initialize Zero client and set it in Svelte context.
 * Call this once in your root layout or app component.
 *
 * @param userID - Unique identifier for the current user (use 'dashboard' for admin)
 * @param server - Zero cache server URL (default: http://localhost:4848)
 * @returns Zero client instance
 */
export function createZero(
  userID: string = "dashboard-admin",
  server: string = "http://localhost:4848"
): ZeroClient {
  const zero = new Zero<Schema>({
    server,
    schema,
    userID,
  });

  setContext(ZERO_KEY, zero);
  return zero;
}

/**
 * Get Zero client from Svelte context.
 * Must be called after createZero() in a parent component.
 */
export function getZero(): ZeroClient {
  const zero = getContext<ZeroClient>(ZERO_KEY);
  if (!zero) {
    throw new Error(
      "Zero not initialized. Call createZero() in a parent component (e.g., +layout.svelte)"
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
 * Create a reactive query that automatically updates when data changes.
 * Handles subscription lifecycle and cleanup automatically.
 *
 * Works with synced queries - just pass the result of calling your query function.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useQuery } from '$lib/zero/client.svelte';
 *   import { recentEvents } from '$lib/zero/queries';
 *
 *   const events = useQuery(recentEvents(projectId, 100));
 * </script>
 *
 * {#each events.data as event}
 *   <div>{event.event_name}</div>
 * {/each}
 * ```
 */
export function useQuery<TReturn>(
  query: Parameters<ZeroClient["materialize"]>[0]
): QueryResult<TReturn> {
  const zero = getZero();

  let data = $state<TReturn[]>([]);
  let loading = $state(true);

  $effect(() => {
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
 *   const project = useQueryOne(projectById(projectId));
 * </script>
 *
 * {#if project.data}
 *   <h1>{project.data.name}</h1>
 * {/if}
 * ```
 */
export function useQueryOne<TReturn>(
  query: Parameters<ZeroClient["materialize"]>[0]
): QueryOneResult<TReturn> {
  const zero = getZero();

  let data = $state<TReturn | undefined>(undefined);
  let loading = $state(true);

  $effect(() => {
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
