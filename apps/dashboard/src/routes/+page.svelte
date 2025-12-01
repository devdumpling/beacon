<script lang="ts">
  import { useQuery } from "$lib/zero/client.svelte";
  import {
    firstProject,
    eventsInWindow,
    sessionsInWindow,
    enabledFlags,
    recentEvents,
  } from "$lib/zero/queries";
  import type { Project, Event, Session, Flag } from "$lib/zero/schema";

  // Get the first project
  const projectQuery = useQuery<Project>(firstProject());

  // Derive project ID reactively
  const projectId = $derived(projectQuery.data?.[0]?.id);

  // Queries that depend on project ID - only run when we have one
  const eventsQuery = $derived(
    projectId ? useQuery<Event>(eventsInWindow(projectId, 7)) : null
  );
  const sessionsQuery = $derived(
    projectId ? useQuery<Session>(sessionsInWindow(projectId, 7)) : null
  );
  const flagsQuery = $derived(
    projectId ? useQuery<Flag>(enabledFlags(projectId)) : null
  );
  const recentEventsQuery = $derived(
    projectId ? useQuery<Event>(recentEvents(projectId, 10)) : null
  );

  // Computed counts
  const eventCount = $derived(eventsQuery?.data?.length ?? 0);
  const sessionCount = $derived(sessionsQuery?.data?.length ?? 0);
  const flagCount = $derived(flagsQuery?.data?.length ?? 0);
  const recentEventsList = $derived(recentEventsQuery?.data ?? []);

  // Loading state
  const loading = $derived(
    projectQuery.loading ||
      eventsQuery?.loading ||
      sessionsQuery?.loading ||
      flagsQuery?.loading
  );
</script>

<svelte:head>
  <title>Beacon Dashboard</title>
</svelte:head>

<div class="space-y-8">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-semibold">Overview</h2>
    {#if loading}
      <span class="text-sm text-gray-500">Syncing...</span>
    {:else}
      <span class="text-sm text-green-600">Live</span>
    {/if}
  </div>

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

  <div class="bg-white rounded-lg shadow">
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
</div>
