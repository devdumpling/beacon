<script lang="ts">
  import { useQuery, useQueryOne } from "$lib/zero/client.svelte";
  import { sessionById, eventsForSession } from "$lib/zero/queries";
  import type { Session, Event } from "$lib/zero/schema";

  let { sessionId }: { sessionId: string } = $props();

  const sessionQuery = useQueryOne<Session>(sessionById(sessionId));
  const eventsQuery = useQuery<Event>(eventsForSession(sessionId));

  const loading = $derived(sessionQuery.loading || eventsQuery.loading);
  const session = $derived(sessionQuery.data);

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

  // Expanded event ID for properties view
  let expandedId = $state<string | null>(null);

  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }
</script>

{#if loading}
  <div class="text-gray-500">Loading session...</div>
{:else if !session}
  <div class="text-gray-500">Session not found.</div>
{:else}
  <!-- Session Metadata -->
  <div class="bg-white rounded-lg shadow p-6 mb-6">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <div class="text-sm text-gray-500">Session ID</div>
        <div class="font-mono text-sm">{session.id}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">User</div>
        <div class="text-sm">
          {session.user_id ?? (session.anon_id ? `Anonymous (${session.anon_id.slice(0, 8)}...)` : "-")}
        </div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Started</div>
        <div class="text-sm">{formatTimestamp(session.started_at)}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Last Event</div>
        <div class="text-sm">{formatTimestamp(session.last_event_at)}</div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Entry URL</div>
        <div class="text-sm font-mono truncate" title={session.entry_url ?? ""}>
          {session.entry_url ?? "-"}
        </div>
      </div>
      <div>
        <div class="text-sm text-gray-500">Events</div>
        <div class="text-sm font-medium">{session.event_count}</div>
      </div>
    </div>
  </div>

  <!-- Event Timeline -->
  <div class="bg-white rounded-lg shadow">
    <div class="p-4 border-b">
      <h3 class="font-semibold">Event Timeline ({eventsQuery.data.length} events)</h3>
    </div>
    {#if eventsQuery.data.length === 0}
      <div class="p-8 text-center text-gray-500">No events recorded.</div>
    {:else}
      <div class="divide-y">
        {#each eventsQuery.data as event (event.id)}
          <div class="p-4 hover:bg-gray-50">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                <div>
                  <div class="font-mono text-sm font-medium">{event.event_name}</div>
                  <div class="text-xs text-gray-500">{formatTimestamp(event.timestamp)}</div>
                </div>
              </div>
              <button
                onclick={() => toggleExpanded(event.id)}
                class="text-sm text-gray-500 hover:text-gray-700"
              >
                {expandedId === event.id ? "Hide" : "Properties"}
              </button>
            </div>
            {#if expandedId === event.id}
              <div class="mt-3 ml-5">
                <pre class="text-xs font-mono bg-gray-100 p-3 rounded overflow-x-auto">{formatProperties(event.properties)}</pre>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
