<script lang="ts">
  import { useQuery } from "$lib/zero/client.svelte";
  import { firstProject } from "$lib/zero/queries";
  import type { Project } from "$lib/zero/schema";
  import SessionsList from "$lib/components/SessionsList.svelte";

  // Get the first project using synced query
  const projectQuery = useQuery<Project>(firstProject());

  // Derive project ID reactively
  const projectId = $derived(projectQuery.data?.[0]?.id);
</script>

<svelte:head>
  <title>Sessions | Beacon</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex justify-between items-center">
    <h2 class="text-2xl font-semibold">Sessions</h2>
    {#if projectQuery.loading}
      <span class="text-sm text-gray-500">Syncing...</span>
    {:else}
      <span class="text-sm text-green-600">Live</span>
    {/if}
  </div>

  {#if projectQuery.loading}
    <div class="text-gray-500">Loading...</div>
  {:else if !projectId}
    <div class="text-gray-500">No project found. Create a project to get started.</div>
  {:else}
    <SessionsList {projectId} />
  {/if}
</div>
