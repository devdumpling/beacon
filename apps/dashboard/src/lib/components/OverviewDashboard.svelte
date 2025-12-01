<script lang="ts">
  import { useQuery } from "$lib/zero/client.svelte";
  import {
    eventsInWindow,
    sessionsInWindow,
    enabledFlags,
    recentEvents,
  } from "$lib/zero/queries";
  import type { Event, Session, Flag } from "$lib/zero/schema";

  // Props - projectId is guaranteed to be defined when this component mounts
  let { projectId }: { projectId: string } = $props();

  // Use synced queries
  const eventsQuery = useQuery<Event>(eventsInWindow(projectId, 7));
  const sessionsQuery = useQuery<Session>(sessionsInWindow(projectId, 7));
  const flagsQuery = useQuery<Flag>(enabledFlags(projectId));
  const recentEventsQuery = useQuery<Event>(recentEvents(projectId, 10));

  // Computed values
  const eventCount = $derived(eventsQuery.data.length);
  const sessionCount = $derived(sessionsQuery.data.length);
  const flagCount = $derived(flagsQuery.data.length);
  const recentEventsList = $derived(recentEventsQuery.data);

  const loading = $derived(
    eventsQuery.loading ||
      sessionsQuery.loading ||
      flagsQuery.loading ||
      recentEventsQuery.loading
  );
</script>

<div class="grid grid-cols-3 gap-6">
  <div class="bg-rp-surface rounded-lg border border-rp-overlay p-6">
    <div class="text-sm text-rp-muted">Events (7d)</div>
    <div class="text-3xl font-bold text-rp-text">
      {#if loading}
        <span class="text-rp-overlay">...</span>
      {:else}
        {eventCount.toLocaleString()}
      {/if}
    </div>
  </div>

  <div class="bg-rp-surface rounded-lg border border-rp-overlay p-6">
    <div class="text-sm text-rp-muted">Sessions (7d)</div>
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

<div class="bg-rp-surface rounded-lg border border-rp-overlay mt-6">
  <div class="p-4 border-b border-rp-overlay">
    <h3 class="font-semibold text-rp-text">Recent Events</h3>
  </div>
  <div class="p-4">
    {#if loading}
      <p class="text-rp-muted">Loading events...</p>
    {:else if recentEventsList.length === 0}
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
          {#each recentEventsList as event}
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
