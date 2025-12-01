/**
 * Zero Custom Mutators for Beacon Dashboard
 *
 * Server-reconciled mutations using the new custom mutators API.
 * These run optimistically on the client and are validated/executed on the server.
 */

import type { Schema } from "./schema";
import type { Transaction } from "@rocicorp/zero";

/**
 * Shared mutator definitions used by both client and server.
 * The server has authority - client results are speculative.
 */
export function createMutators() {
  return {
    flags: {
      /**
       * Toggle a feature flag's enabled state
       */
      toggle: async (
        tx: Transaction<Schema>,
        { id, enabled }: { id: string; enabled: boolean }
      ) => {
        await tx.mutate.flags.update({
          id,
          enabled,
          updated_at: new Date().toISOString(),
        });
      },

      /**
       * Create a new feature flag
       */
      create: async (
        tx: Transaction<Schema>,
        {
          id,
          project_id,
          key,
          name,
          enabled = false,
        }: {
          id: string;
          project_id: string;
          key: string;
          name: string;
          enabled?: boolean;
        }
      ) => {
        const now = new Date().toISOString();
        await tx.mutate.flags.insert({
          id,
          project_id,
          key,
          name,
          enabled,
          created_at: now,
          updated_at: now,
        });
      },

      /**
       * Delete a feature flag
       */
      delete: async (tx: Transaction<Schema>, { id }: { id: string }) => {
        await tx.mutate.flags.delete({ id });
      },
    },
  } as const;
}

export type Mutators = ReturnType<typeof createMutators>;
