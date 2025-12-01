<script lang="ts">
  import { useQuery, getZero } from "$lib/zero/client.svelte";
  import { flagsForProject } from "$lib/zero/queries";
  import type { Flag } from "$lib/zero/schema";

  let { projectId }: { projectId: string } = $props();

  const zero = getZero();
  const flagsQuery = useQuery<Flag>(flagsForProject(projectId));

  // Form state
  let newFlagKey = $state("");
  let newFlagName = $state("");
  let creating = $state(false);

  async function toggleFlag(id: string, currentEnabled: boolean) {
    await zero.mutate.flags.toggle({
      id,
      enabled: !currentEnabled,
    });
  }

  async function createFlag() {
    if (!newFlagKey || !newFlagName) return;
    creating = true;
    await zero.mutate.flags.create({
      id: crypto.randomUUID(),
      project_id: projectId,
      key: newFlagKey,
      name: newFlagName,
      enabled: false,
    });
    newFlagKey = "";
    newFlagName = "";
    creating = false;
  }

  async function deleteFlag(id: string) {
    if (!confirm("Delete this flag?")) return;
    await zero.mutate.flags.delete({ id });
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
  }
</script>

<!-- Create Flag -->
<div class="bg-white rounded-lg shadow">
  <div class="p-4 border-b">
    <h3 class="font-semibold">Create Flag</h3>
  </div>
  <div class="p-4 flex gap-4">
    <input
      type="text"
      bind:value={newFlagKey}
      placeholder="flag_key"
      class="flex-1 px-3 py-2 border rounded font-mono text-sm"
    />
    <input
      type="text"
      bind:value={newFlagName}
      placeholder="Human readable name"
      class="flex-1 px-3 py-2 border rounded"
    />
    <button
      onclick={createFlag}
      disabled={creating || !newFlagKey || !newFlagName}
      class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {creating ? "Creating..." : "Create"}
    </button>
  </div>
</div>

<!-- Flags Table -->
<div class="bg-white rounded-lg shadow">
  {#if flagsQuery.loading}
    <div class="p-8 text-center text-gray-500">Loading flags...</div>
  {:else if flagsQuery.data.length === 0}
    <div class="p-8 text-center text-gray-500">
      No flags yet. Create one above.
    </div>
  {:else}
    <table class="w-full">
      <thead class="border-b">
        <tr class="text-left">
          <th class="p-4">Key</th>
          <th class="p-4">Name</th>
          <th class="p-4">Status</th>
          <th class="p-4">Updated</th>
          <th class="p-4"></th>
        </tr>
      </thead>
      <tbody>
        {#each flagsQuery.data as flag (flag.id)}
          <tr class="border-b last:border-0">
            <td class="p-4 font-mono text-sm">{flag.key}</td>
            <td class="p-4">{flag.name}</td>
            <td class="p-4">
              <button
                onclick={() => toggleFlag(flag.id, flag.enabled)}
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {flag.enabled ? 'bg-blue-600' : 'bg-gray-200'}"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {flag.enabled ? 'translate-x-6' : 'translate-x-1'}"
                />
              </button>
            </td>
            <td class="p-4 text-gray-500 text-sm">
              {formatTimestamp(flag.updated_at)}
            </td>
            <td class="p-4">
              <button
                onclick={() => deleteFlag(flag.id)}
                class="text-red-500 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
