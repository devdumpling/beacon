<script lang="ts">
  import { useQuery } from "$lib/zero/client.svelte";
  import { recentSessions } from "$lib/zero/queries";
  import { formatTimestamp, formatRelativeTime } from "$lib/utils/formatters";

  let { projectId }: { projectId: string } = $props();

  // Use getter function so query re-runs if projectId changes
  // Types inferred automatically from the query
  const sessionsQuery = useQuery(() => recentSessions(projectId, 100));
</script>

<div class="bg-rp-surface rounded-lg border border-rp-overlay">
  {#if sessionsQuery.loading}
    <div class="p-8 text-center text-rp-muted">Loading sessions...</div>
  {:else if sessionsQuery.data.length === 0}
    <div class="p-8 text-center text-rp-muted">
      No sessions yet. Start tracking with the SDK.
    </div>
  {:else}
    <table class="w-full">
      <thead class="border-b border-rp-overlay bg-rp-overlay/30">
        <tr class="text-left text-sm text-rp-muted">
          <th class="p-4">Session ID</th>
          <th class="p-4">User</th>
          <th class="p-4">Started</th>
          <th class="p-4">Last Event</th>
          <th class="p-4">Events</th>
        </tr>
      </thead>
      <tbody>
        {#each sessionsQuery.data as session (session.id)}
          <tr class="border-b border-rp-overlay last:border-0 hover:bg-rp-overlay/30">
            <td class="p-4">
              <a
                href="/sessions/{session.id}"
                class="font-mono text-sm text-rp-iris hover:underline"
              >
                {session.id.slice(0, 8)}...
              </a>
            </td>
            <td class="p-4 text-sm text-rp-subtle">
              {session.user_id ?? (session.anon_id ? session.anon_id.slice(0, 8) + "..." : "-")}
            </td>
            <td class="p-4 text-sm text-rp-subtle" title={formatTimestamp(session.started_at)}>
              {formatRelativeTime(session.started_at)}
            </td>
            <td class="p-4 text-sm text-rp-subtle" title={formatTimestamp(session.last_event_at)}>
              {formatRelativeTime(session.last_event_at)}
            </td>
            <td class="p-4 text-sm font-medium text-rp-text">
              {session.event_count}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
