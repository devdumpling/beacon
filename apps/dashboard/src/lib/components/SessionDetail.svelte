<script lang="ts">
  import { useQuery, useQueryOne } from "$lib/zero/client.svelte";
  import { sessionById, eventsForSession } from "$lib/zero/queries";
  import type { Session, Event } from "$lib/zero/schema";

  let { sessionId }: { sessionId: string } = $props();

  // Use getter functions so queries re-run if sessionId changes
  const sessionQuery = useQueryOne<Session>(() => sessionById(sessionId));
  const eventsQuery = useQuery<Event>(() => eventsForSession(sessionId));

  const loading = $derived(sessionQuery.loading || eventsQuery.loading);
  const session = $derived(sessionQuery.data);

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

  // Expanded event ID for properties view
  let expandedId = $state<string | null>(null);

  function toggleExpanded(id: string) {
    expandedId = expandedId === id ? null : id;
  }
</script>

{#if loading}
  <div class="text-rp-muted">Loading session...</div>
{:else if !session}
  <div class="text-rp-muted">Session not found.</div>
{:else}
  <!-- Session Metadata -->
  <div class="bg-rp-surface rounded-lg border border-rp-overlay p-6 mb-6">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <div class="text-sm text-rp-muted">Session ID</div>
        <div class="font-mono text-sm text-rp-text">{session.id}</div>
      </div>
      <div>
        <div class="text-sm text-rp-muted">User</div>
        <div class="text-sm text-rp-text">
          {session.user_id ?? (session.anon_id ? `Anonymous (${session.anon_id.slice(0, 8)}...)` : "-")}
        </div>
      </div>
      <div>
        <div class="text-sm text-rp-muted">Started</div>
        <div class="text-sm text-rp-text">{formatTimestamp(session.started_at)}</div>
      </div>
      <div>
        <div class="text-sm text-rp-muted">Last Event</div>
        <div class="text-sm text-rp-text">{formatTimestamp(session.last_event_at)}</div>
      </div>
      <div>
        <div class="text-sm text-rp-muted">Entry URL</div>
        <div class="text-sm font-mono truncate text-rp-subtle" title={session.entry_url ?? ""}>
          {session.entry_url ?? "-"}
        </div>
      </div>
      <div>
        <div class="text-sm text-rp-muted">Events</div>
        <div class="text-sm font-medium text-rp-text">{session.event_count}</div>
      </div>
    </div>
  </div>

  <!-- Event Timeline -->
  <div class="bg-rp-surface rounded-lg border border-rp-overlay">
    <div class="p-4 border-b border-rp-overlay">
      <h3 class="font-semibold text-rp-text">Event Timeline ({eventsQuery.data.length} events)</h3>
    </div>
    {#if eventsQuery.data.length === 0}
      <div class="p-8 text-center text-rp-muted">No events recorded.</div>
    {:else}
      <div class="divide-y divide-rp-overlay">
        {#each eventsQuery.data as event (event.id)}
          <div class="p-4 hover:bg-rp-overlay/30">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full bg-rp-iris"></div>
                <div>
                  <div class="font-mono text-sm font-medium text-rp-text">{event.event_name}</div>
                  <div class="text-xs text-rp-muted">{formatTimestamp(event.timestamp)}</div>
                </div>
              </div>
              <button
                onclick={() => toggleExpanded(event.id)}
                class="text-sm text-rp-muted hover:text-rp-text"
              >
                {expandedId === event.id ? "Hide" : "Properties"}
              </button>
            </div>
            {#if expandedId === event.id}
              <div class="mt-3 ml-5">
                <pre class="text-xs font-mono bg-rp-base text-rp-text p-3 rounded overflow-x-auto">{formatProperties(event.properties)}</pre>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
