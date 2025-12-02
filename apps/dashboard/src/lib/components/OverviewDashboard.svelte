<script lang="ts">
  import { useQuery } from "$lib/zero/client.svelte";
  import {
    eventsInWindow,
    sessionsInWindow,
    enabledFlags,
    recentEvents,
  } from "$lib/zero/queries";
  import EventsOverTimeChart from "./charts/EventsOverTimeChart.svelte";
  import SessionsTrendChart from "./charts/SessionsTrendChart.svelte";
  import TopEventsChart from "./charts/TopEventsChart.svelte";

  // Props - projectId is guaranteed to be defined when this component mounts
  let { projectId }: { projectId: string } = $props();

  // Date range state
  let days = $state(7);

  // Reactive synced queries - use getter functions so queries re-run when params change
  // Types are inferred automatically from the queries
  const eventsQuery = useQuery(() => eventsInWindow(projectId, days));
  const sessionsQuery = useQuery(() => sessionsInWindow(projectId, days));
  const flagsQuery = useQuery(() => enabledFlags(projectId));
  const recentQuery = useQuery(() => recentEvents(projectId, 10));

  // Computed values
  const loading = $derived(
    eventsQuery.loading || sessionsQuery.loading || flagsQuery.loading || recentQuery.loading
  );
  const eventCount = $derived(eventsQuery.data.length);
  const sessionCount = $derived(sessionsQuery.data.length);
  const flagCount = $derived(flagsQuery.data.length);
</script>

<!-- Date Range Picker -->
<div class="flex items-center justify-between mb-6">
  <h2 class="text-lg font-semibold text-rp-text">Analytics Overview</h2>
  <div class="flex gap-2">
    <button
      class="px-3 py-1 text-sm rounded {days === 7 ? 'bg-rp-iris text-rp-base' : 'bg-rp-surface text-rp-subtle hover:bg-rp-overlay'}"
      onclick={() => days = 7}
    >
      7 days
    </button>
    <button
      class="px-3 py-1 text-sm rounded {days === 30 ? 'bg-rp-iris text-rp-base' : 'bg-rp-surface text-rp-subtle hover:bg-rp-overlay'}"
      onclick={() => days = 30}
    >
      30 days
    </button>
    <button
      class="px-3 py-1 text-sm rounded {days === 90 ? 'bg-rp-iris text-rp-base' : 'bg-rp-surface text-rp-subtle hover:bg-rp-overlay'}"
      onclick={() => days = 90}
    >
      90 days
    </button>
  </div>
</div>

<!-- Stats Cards -->
<div class="grid grid-cols-3 gap-6">
  <div class="bg-rp-surface rounded-lg border border-rp-overlay p-6">
    <div class="text-sm text-rp-muted">Events ({days}d)</div>
    <div class="text-3xl font-bold text-rp-text">
      {#if loading}
        <span class="text-rp-overlay">...</span>
      {:else}
        {eventCount.toLocaleString()}
      {/if}
    </div>
  </div>

  <div class="bg-rp-surface rounded-lg border border-rp-overlay p-6">
    <div class="text-sm text-rp-muted">Sessions ({days}d)</div>
    <div class="text-3xl font-bold text-rp-text">
      {#if loading}
        <span class="text-rp-overlay">...</span>
      {:else}
        {sessionCount.toLocaleString()}
      {/if}
    </div>
  </div>

  <div class="bg-rp-surface rounded-lg border border-rp-overlay p-6">
    <div class="text-sm text-rp-muted">Active Flags</div>
    <div class="text-3xl font-bold text-rp-text">
      {#if loading}
        <span class="text-rp-overlay">...</span>
      {:else}
        {flagCount}
      {/if}
    </div>
  </div>
</div>

<!-- Charts Row -->
<div class="grid grid-cols-2 gap-6 mt-6">
  <div class="bg-rp-surface rounded-lg border border-rp-overlay p-6">
    <h3 class="font-semibold text-rp-text mb-4">Events Over Time</h3>
    {#if loading}
      <div class="h-48 flex items-center justify-center text-rp-muted">Loading...</div>
    {:else}
      <EventsOverTimeChart events={eventsQuery.data} {days} />
    {/if}
  </div>

  <div class="bg-rp-surface rounded-lg border border-rp-overlay p-6">
    <h3 class="font-semibold text-rp-text mb-4">Sessions Over Time</h3>
    {#if loading}
      <div class="h-48 flex items-center justify-center text-rp-muted">Loading...</div>
    {:else}
      <SessionsTrendChart sessions={sessionsQuery.data} {days} />
    {/if}
  </div>
</div>

<!-- Top Events Chart -->
<div class="bg-rp-surface rounded-lg border border-rp-overlay p-6 mt-6">
  <h3 class="font-semibold text-rp-text mb-4">Top Events</h3>
  {#if loading}
    <div class="h-48 flex items-center justify-center text-rp-muted">Loading...</div>
  {:else}
    <TopEventsChart events={eventsQuery.data} limit={5} />
  {/if}
</div>

<!-- Recent Events Table -->
<div class="bg-rp-surface rounded-lg border border-rp-overlay mt-6">
  <div class="p-4 border-b border-rp-overlay">
    <h3 class="font-semibold text-rp-text">Recent Events</h3>
  </div>
  <div class="p-4">
    {#if loading}
      <p class="text-rp-muted">Loading events...</p>
    {:else if recentQuery.data.length === 0}
      <p class="text-rp-muted">No events yet. Integrate the SDK to start tracking.</p>
    {:else}
      <table class="w-full">
        <thead>
          <tr class="text-left text-sm text-rp-muted">
            <th class="pb-2">Event</th>
            <th class="pb-2">Time</th>
            <th class="pb-2">Session</th>
          </tr>
        </thead>
        <tbody>
          {#each recentQuery.data as event}
            <tr class="border-t border-rp-overlay">
              <td class="py-2 font-mono text-sm text-rp-text">{event.event_name}</td>
              <td class="py-2 text-sm text-rp-subtle">
                {new Date(event.timestamp).toLocaleString()}
              </td>
              <td class="py-2 text-sm text-rp-muted font-mono">
                {event.session_id.slice(0, 8)}...
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
