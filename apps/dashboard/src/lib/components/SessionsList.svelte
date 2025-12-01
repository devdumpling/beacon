<script lang="ts">
  import { useQuery } from "$lib/zero/client.svelte";
  import { recentSessions } from "$lib/zero/queries";
  import type { Session } from "$lib/zero/schema";

  let { projectId }: { projectId: string } = $props();

  const sessionsQuery = useQuery<Session>(recentSessions(projectId, 100));

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
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
