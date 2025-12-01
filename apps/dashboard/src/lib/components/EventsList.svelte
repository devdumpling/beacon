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

  function formatProperties(props: string | null): string {
    if (!props) return "{}";
    try {
      return JSON.stringify(JSON.parse(props), null, 2);
    } catch {
      return props;
    }
  }

  function loadMore() {
    displayLimit += 100;
  }
</script>

<!-- Filter -->
<div class="bg-white rounded-lg shadow">
  <div class="p-4 flex gap-4 items-center">
    <input
      type="text"
      bind:value={filterName}
      placeholder="Filter by event name..."
      class="flex-1 px-3 py-2 border rounded text-sm"
    />
    {#if filterName}
      <button
        onclick={() => (filterName = "")}
        class="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
      >
        Clear
      </button>
    {/if}
  </div>
</div>

<!-- Events Table -->
<div class="bg-white rounded-lg shadow">
  {#if eventsQuery.loading}
    <div class="p-8 text-center text-gray-500">Loading events...</div>
  {:else if filteredEvents.length === 0}
    <div class="p-8 text-center text-gray-500">
      {#if filterName}
        No events match "{filterName}"
      {:else}
        No events yet. Integrate the SDK to start tracking.
      {/if}
    </div>
  {:else}
    <table class="w-full">
      <thead class="border-b bg-gray-50">
        <tr class="text-left text-sm text-gray-500">
          <th class="p-4">Time</th>
          <th class="p-4">Event</th>
          <th class="p-4">Session</th>
          <th class="p-4">User</th>
          <th class="p-4">Properties</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredEvents as event (event.id)}
          <tr class="border-b last:border-0 hover:bg-gray-50">
            <td class="p-4 text-sm text-gray-500 whitespace-nowrap">
              {formatTimestamp(event.timestamp)}
            </td>
            <td class="p-4 font-mono text-sm">{event.event_name}</td>
            <td class="p-4">
              <a
                href="/sessions/{event.session_id}"
                class="font-mono text-sm text-blue-600 hover:underline"
              >
                {event.session_id.slice(0, 8)}...
              </a>
            </td>
            <td class="p-4 text-sm text-gray-500">
              {event.user_id ?? (event.anon_id ? event.anon_id.slice(0, 8) + "..." : "-")}
            </td>
            <td class="p-4">
              <button
                onclick={() => toggleExpanded(event.id)}
                class="text-sm text-gray-500 hover:text-gray-700"
              >
                {expandedId === event.id ? "Hide" : "Show"}
              </button>
            </td>
          </tr>
          {#if expandedId === event.id}
            <tr class="bg-gray-50">
              <td colspan="5" class="p-4">
                <pre class="text-xs font-mono bg-gray-100 p-3 rounded overflow-x-auto">{formatProperties(event.properties)}</pre>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>

    {#if hasMore}
      <div class="p-4 border-t text-center">
        <button
          onclick={loadMore}
          class="px-4 py-2 text-sm text-blue-600 hover:text-blue-700"
        >
          Load more events ({eventsQuery.data.length - displayLimit} remaining)
        </button>
      </div>
    {/if}
  {/if}
</div>
