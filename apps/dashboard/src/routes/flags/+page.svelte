<script lang="ts">
  import { useQuery } from "$lib/zero/client.svelte";
  import { firstProject } from "$lib/zero/queries";
  import type { Project } from "$lib/zero/schema";
  import FlagsList from "$lib/components/FlagsList.svelte";

  // Get the first project using synced query
  const projectQuery = useQuery<Project>(firstProject());

  // Derive project ID reactively
  const projectId = $derived(projectQuery.data?.[0]?.id);
</script>

<svelte:head>
  <title>Feature Flags | Beacon</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h2 class="text-2xl font-semibold text-rp-text">Feature Flags</h2>
    {#if projectQuery.loading}
      <span class="text-sm text-rp-muted">Syncing...</span>
    {:else}
      <span class="text-sm text-rp-pine">Live</span>
    {/if}
  </div>

  {#if projectQuery.loading}
    <div class="text-rp-muted">Loading...</div>
  {:else if !projectId}
    <div class="text-rp-muted">No project found. Create a project to get started.</div>
  {:else}
    <FlagsList {projectId} />
  {/if}
</div>
