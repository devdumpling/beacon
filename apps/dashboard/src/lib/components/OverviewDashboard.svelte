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
  <div class="bg-white rounded-lg shadow p-6">
    <div class="text-sm text-gray-500">Events (7d)</div>
    <div class="text-3xl font-bold">
      {#if loading}
        <span class="text-gray-300">...</span>
      {:else}
        {eventCount.toLocaleString()}
      {/if}
    </div>
  </div>

  <div class="bg-white rounded-lg shadow p-6">
    <div class="text-sm text-gray-500">Sessions (7d)</div>
    <div class="text-3xl font-bold">
      {#if loading}
        <span class="text-gray-300">...</span>
      {:else}
        {sessionCount.toLocaleString()}
      {/if}
    </div>
  </div>

  <div class="bg-white rounded-lg shadow p-6">
    <div class="text-sm text-gray-500">Active Flags</div>
    <div class="text-3xl font-bold">
      {#if loading}
        <span class="text-gray-300">...</span>
      {:else}
        {flagCount}
      {/if}
    </div>
  </div>
</div>

<div class="bg-white rounded-lg shadow mt-6">
  <div class="p-4 border-b">
    <h3 class="font-semibold">Recent Events</h3>
  </div>
  <div class="p-4">
    {#if loading}
      <p class="text-gray-500">Loading events...</p>
    {:else if recentEventsList.length === 0}
      <p class="text-gray-500">No events yet. Integrate the SDK to start tracking.</p>
    {:else}
      <table class="w-full">
        <thead>
          <tr class="text-left text-sm text-gray-500">
            <th class="pb-2">Event</th>
            <th class="pb-2">Time</th>
            <th class="pb-2">Session</th>
          </tr>
        </thead>
        <tbody>
          {#each recentEventsList as event}
            <tr class="border-t">
              <td class="py-2 font-mono text-sm">{event.event_name}</td>
              <td class="py-2 text-sm text-gray-500">
                {new Date(event.timestamp).toLocaleString()}
              </td>
              <td class="py-2 text-sm text-gray-400 font-mono">
                {event.session_id.slice(0, 8)}...
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
