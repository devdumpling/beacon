<script lang="ts">
  import { useQuery } from "$lib/zero/client.svelte";
  import { recentEvents } from "$lib/zero/queries";
  import type { Event } from "$lib/zero/schema";

  let { projectId }: { projectId: string } = $props();

  // Fetch a larger set and paginate client-side
  const eventsQuery = useQuery<Event>(recentEvents(projectId, 500));

  // Client-side pagination
  let displayLimit = $state(100);
  const displayedEvents = $derived(eventsQuery.data.slice(0, displayLimit));
  const hasMore = $derived(eventsQuery.data.length > displayLimit);

  // Filter
  let filterName = $state("");
  const filteredEvents = $derived(
    filterName
      ? displayedEvents.filter((e) =>
          e.event_name.toLowerCase().includes(filterName.toLowerCase())
        )
      : displayedEvents
  );

  // Expanded properties
  let expandedId = $state<string | null>(null);

  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function formatProperties(props: Record<string, unknown> | null | undefined): string {
    if (!props) return "{}";
    try {
      return JSON.stringify(props, null, 2);
    } catch {
      return String(props);
    }
  }

  function loadMore() {
    displayLimit += 100;
  }
</script>

<!-- Filter -->
<div class="bg-rp-surface rounded-lg border border-rp-overlay">
  <div class="p-4 flex gap-4 items-center">
    <input
      type="text"
      bind:value={filterName}
      placeholder="Filter by event name..."
      class="flex-1 px-3 py-2 bg-rp-base border border-rp-overlay rounded text-sm text-rp-text placeholder-rp-muted focus:border-rp-iris focus:outline-none"
    />
    {#if filterName}
      <button
        onclick={() => (filterName = "")}
        class="px-3 py-2 text-sm text-rp-muted hover:text-rp-text"
      >
        Clear
      </button>
    {/if}
  </div>
</div>

<!-- Events Table -->
<div class="bg-rp-surface rounded-lg border border-rp-overlay">
  {#if eventsQuery.loading}
    <div class="p-8 text-center text-rp-muted">Loading events...</div>
  {:else if filteredEvents.length === 0}
    <div class="p-8 text-center text-rp-muted">
      {#if filterName}
        No events match "{filterName}"
      {:else}
        No events yet. Integrate the SDK to start tracking.
      {/if}
    </div>
  {:else}
    <table class="w-full">
      <thead class="border-b border-rp-overlay bg-rp-overlay/30">
        <tr class="text-left text-sm text-rp-muted">
          <th class="p-4">Time</th>
          <th class="p-4">Event</th>
          <th class="p-4">Session</th>
          <th class="p-4">User</th>
          <th class="p-4">Properties</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredEvents as event (event.id)}
          <tr class="border-b border-rp-overlay last:border-0 hover:bg-rp-overlay/30">
            <td class="p-4 text-sm text-rp-subtle whitespace-nowrap">
              {formatTimestamp(event.timestamp)}
            </td>
            <td class="p-4 font-mono text-sm text-rp-text">{event.event_name}</td>
            <td class="p-4">
              <a
                href="/sessions/{event.session_id}"
                class="font-mono text-sm text-rp-iris hover:underline"
              >
                {event.session_id.slice(0, 8)}...
              </a>
            </td>
            <td class="p-4 text-sm text-rp-subtle">
              {event.user_id ?? (event.anon_id ? event.anon_id.slice(0, 8) + "..." : "-")}
            </td>
            <td class="p-4">
              <button
                onclick={() => toggleExpanded(event.id)}
                class="text-sm text-rp-muted hover:text-rp-text"
              >
                {expandedId === event.id ? "Hide" : "Show"}
              </button>
            </td>
          </tr>
          {#if expandedId === event.id}
            <tr class="bg-rp-overlay/30">
              <td colspan="5" class="p-4">
                <pre class="text-xs font-mono bg-rp-base text-rp-text p-3 rounded overflow-x-auto">{formatProperties(event.properties)}</pre>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>

    {#if hasMore}
      <div class="p-4 border-t border-rp-overlay text-center">
        <button
          onclick={loadMore}
          class="px-4 py-2 text-sm text-rp-iris hover:text-rp-foam"
        >
          Load more events ({eventsQuery.data.length - displayLimit} remaining)
        </button>
      </div>
    {/if}
  {/if}
</div>
