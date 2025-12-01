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
    <a href="/sessions" class="text-rp-muted hover:text-rp-text">&larr; Sessions</a>
    <h2 class="text-2xl font-semibold text-rp-text">Session Detail</h2>
  </div>

  {#if sessionId}
    <SessionDetail {sessionId} />
  {:else}
    <div class="text-rp-muted">Invalid session ID.</div>
  {/if}
</div>
