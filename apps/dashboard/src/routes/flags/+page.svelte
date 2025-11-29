<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  
  let { data } = $props();
  
  let newFlagKey = $state("");
  let newFlagName = $state("");
  let creating = $state(false);
  
  async function toggle(flagId: string, enabled: boolean) {
    await fetch("/flags/toggle", {
      method: "POST",
      body: JSON.stringify({ flagId, enabled }),
      headers: { "Content-Type": "application/json" },
    });
    invalidateAll();
  }
  
  async function create() {
    if (!newFlagKey || !newFlagName) return;
    creating = true;
    await fetch("/flags/create", {
      method: "POST",
      body: JSON.stringify({ key: newFlagKey, name: newFlagName }),
      headers: { "Content-Type": "application/json" },
    });
    newFlagKey = "";
    newFlagName = "";
    creating = false;
    invalidateAll();
  }
</script>

<svelte:head>
  <title>Feature Flags | Beacon</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h2 class="text-2xl font-semibold">Feature Flags</h2>
  </div>
  
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
        onclick={create}
        disabled={creating || !newFlagKey || !newFlagName}
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {creating ? "Creating..." : "Create"}
      </button>
    </div>
  </div>
  
  <div class="bg-white rounded-lg shadow">
    <table class="w-full">
      <thead class="border-b">
        <tr class="text-left">
          <th class="p-4">Key</th>
          <th class="p-4">Name</th>
          <th class="p-4">Status</th>
          <th class="p-4">Updated</th>
        </tr>
      </thead>
      <tbody>
        {#each data.flags as flag}
          <tr class="border-b last:border-0">
            <td class="p-4 font-mono text-sm">{flag.key}</td>
            <td class="p-4">{flag.name}</td>
            <td class="p-4">
              <button
                onclick={() => toggle(flag.id, !flag.enabled)}
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {flag.enabled ? 'bg-blue-600' : 'bg-gray-200'}"
              >
                <span
                  class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {flag.enabled ? 'translate-x-6' : 'translate-x-1'}"
                />
              </button>
            </td>
            <td class="p-4 text-gray-500 text-sm">
              {new Date(flag.updated_at).toLocaleString()}
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="4" class="p-4 text-center text-gray-500">
              No flags yet. Create one above.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
