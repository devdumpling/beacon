<script lang="ts">
  import { page } from "$app/stores";
  import SessionDetail from "$lib/components/SessionDetail.svelte";

  const sessionId = $derived($page.params.id);
</script>

<svelte:head>
  <title>Session {sessionId?.slice(0, 8)}... | Beacon</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <a href="/sessions" class="text-gray-500 hover:text-gray-700">&larr; Sessions</a>
    <h2 class="text-2xl font-semibold">Session Detail</h2>
  </div>

  {#if sessionId}
    <SessionDetail {sessionId} />
  {:else}
    <div class="text-gray-500">Invalid session ID.</div>
  {/if}
</div>
