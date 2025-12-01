<script lang="ts">
  import { getZero } from "$lib/zero/client.svelte";
  import {
    eventsInWindow,
    sessionsInWindow,
    enabledFlags,
    recentEvents,
  } from "$lib/zero/queries";
  import type { Event, Session, Flag } from "$lib/zero/schema";
  import EventsOverTimeChart from "./charts/EventsOverTimeChart.svelte";
  import SessionsTrendChart from "./charts/SessionsTrendChart.svelte";
  import TopEventsChart from "./charts/TopEventsChart.svelte";

  // Props - projectId is guaranteed to be defined when this component mounts
  let { projectId }: { projectId: string } = $props();

  // Date range state
  let days = $state(7);

  // Get Zero client
  const zero = getZero();

  // Reactive query data using $state and $effect for proper reactivity
  let eventsData = $state<Event[]>([]);
  let sessionsData = $state<Session[]>([]);
  let flagsData = $state<Flag[]>([]);
  let recentEventsData = $state<Event[]>([]);
  let loading = $state(true);

  // Effect to handle all queries reactively when projectId or days change
  $effect(() => {
    // Capture reactive values
    const pid = projectId;
    const d = days;

    // Create queries
    const eventsQ = eventsInWindow(pid, d);
    const sessionsQ = sessionsInWindow(pid, d);
    const flagsQ = enabledFlags(pid);
    const recentQ = recentEvents(pid, 10);

    // Materialize and subscribe
    const eventsView = zero.materialize(eventsQ);
    const sessionsView = zero.materialize(sessionsQ);
    const flagsView = zero.materialize(flagsQ);
    const recentView = zero.materialize(recentQ);

    const unsubEvents = eventsView.addListener((data) => {
      eventsData = Array.isArray(data) ? [...data] as Event[] : [];
    });
    const unsubSessions = sessionsView.addListener((data) => {
      sessionsData = Array.isArray(data) ? [...data] as Session[] : [];
    });
    const unsubFlags = flagsView.addListener((data) => {
      flagsData = Array.isArray(data) ? [...data] as Flag[] : [];
    });
    const unsubRecent = recentView.addListener((data) => {
      recentEventsData = Array.isArray(data) ? [...data] as Event[] : [];
    });

    // Run initial queries
    Promise.all([
      zero.run(eventsQ),
      zero.run(sessionsQ),
      zero.run(flagsQ),
      zero.run(recentQ),
    ]).then(([events, sessions, flags, recent]) => {
      eventsData = Array.isArray(events) ? [...events] as Event[] : [];
      sessionsData = Array.isArray(sessions) ? [...sessions] as Session[] : [];
      flagsData = Array.isArray(flags) ? [...flags] as Flag[] : [];
      recentEventsData = Array.isArray(recent) ? [...recent] as Event[] : [];
      loading = false;
    });

    return () => {
      unsubEvents();
      unsubSessions();
      unsubFlags();
      unsubRecent();
    };
  });

  // Computed values
  const eventCount = $derived(eventsData.length);
  const sessionCount = $derived(sessionsData.length);
  const flagCount = $derived(flagsData.length);
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
      <EventsOverTimeChart events={eventsData} {days} />
    {/if}
  </div>

  <div class="bg-rp-surface rounded-lg border border-rp-overlay p-6">
    <h3 class="font-semibold text-rp-text mb-4">Sessions Over Time</h3>
    {#if loading}
      <div class="h-48 flex items-center justify-center text-rp-muted">Loading...</div>
    {:else}
      <SessionsTrendChart sessions={sessionsData} {days} />
    {/if}
  </div>
</div>

<!-- Top Events Chart -->
<div class="bg-rp-surface rounded-lg border border-rp-overlay p-6 mt-6">
  <h3 class="font-semibold text-rp-text mb-4">Top Events</h3>
  {#if loading}
    <div class="h-48 flex items-center justify-center text-rp-muted">Loading...</div>
  {:else}
    <TopEventsChart events={eventsData} limit={5} />
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
    {:else if recentEventsData.length === 0}
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
          {#each recentEventsData as event}
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
