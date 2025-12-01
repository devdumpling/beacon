<script lang="ts">
  import { useQuery, getZero } from "$lib/zero/client.svelte";
  import { flagsForProject } from "$lib/zero/queries";
  import type { Flag } from "$lib/zero/schema";

  let { projectId }: { projectId: string } = $props();

  const zero = getZero();
  // Use getter function so query re-runs if projectId changes
  const flagsQuery = useQuery<Flag>(() => flagsForProject(projectId));

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
<div class="bg-rp-surface rounded-lg border border-rp-overlay">
  <div class="p-4 border-b border-rp-overlay">
    <h3 class="font-semibold text-rp-text">Create Flag</h3>
  </div>
  <div class="p-4 flex gap-4">
    <input
      type="text"
      bind:value={newFlagKey}
      placeholder="flag_key"
      class="flex-1 px-3 py-2 bg-rp-base border border-rp-overlay rounded font-mono text-sm text-rp-text placeholder-rp-muted focus:border-rp-iris focus:outline-none"
    />
    <input
      type="text"
      bind:value={newFlagName}
      placeholder="Human readable name"
      class="flex-1 px-3 py-2 bg-rp-base border border-rp-overlay rounded text-rp-text placeholder-rp-muted focus:border-rp-iris focus:outline-none"
    />
    <button
      onclick={createFlag}
      disabled={creating || !newFlagKey || !newFlagName}
      class="px-4 py-2 bg-rp-iris text-rp-base rounded hover:bg-rp-foam disabled:opacity-50"
    >
      {creating ? "Creating..." : "Create"}
    </button>
  </div>
</div>

<!-- Flags Table -->
<div class="bg-rp-surface rounded-lg border border-rp-overlay">
  {#if flagsQuery.loading}
    <div class="p-8 text-center text-rp-muted">Loading flags...</div>
  {:else if flagsQuery.data.length === 0}
    <div class="p-8 text-center text-rp-muted">
      No flags yet. Create one above.
    </div>
  {:else}
    <table class="w-full">
      <thead class="border-b border-rp-overlay">
        <tr class="text-left text-rp-muted">
          <th class="p-4">Key</th>
          <th class="p-4">Name</th>
          <th class="p-4">Status</th>
          <th class="p-4">Updated</th>
          <th class="p-4"></th>
        </tr>
      </thead>
      <tbody>
        {#each flagsQuery.data as flag (flag.id)}
          <tr class="border-b border-rp-overlay last:border-0">
            <td class="p-4 font-mono text-sm text-rp-text">{flag.key}</td>
            <td class="p-4 text-rp-text">{flag.name}</td>
            <td class="p-4">
              <button
                onclick={() => toggleFlag(flag.id, flag.enabled)}
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {flag.enabled ? 'bg-rp-pine' : 'bg-rp-overlay'}"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-rp-text transition-transform {flag.enabled ? 'translate-x-6' : 'translate-x-1'}"
                />
              </button>
            </td>
            <td class="p-4 text-rp-subtle text-sm">
              {formatTimestamp(flag.updated_at)}
            </td>
            <td class="p-4">
              <button
                onclick={() => deleteFlag(flag.id)}
                class="text-rp-love hover:text-rp-rose text-sm"
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
