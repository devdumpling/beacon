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

<div class="bg-white rounded-lg shadow">
  {#if sessionsQuery.loading}
    <div class="p-8 text-center text-gray-500">Loading sessions...</div>
  {:else if sessionsQuery.data.length === 0}
    <div class="p-8 text-center text-gray-500">
      No sessions yet. Start tracking with the SDK.
    </div>
  {:else}
    <table class="w-full">
      <thead class="border-b bg-gray-50">
        <tr class="text-left text-sm text-gray-500">
          <th class="p-4">Session ID</th>
          <th class="p-4">User</th>
          <th class="p-4">Started</th>
          <th class="p-4">Last Event</th>
          <th class="p-4">Events</th>
        </tr>
      </thead>
      <tbody>
        {#each sessionsQuery.data as session (session.id)}
          <tr class="border-b last:border-0 hover:bg-gray-50">
            <td class="p-4">
              <a
                href="/sessions/{session.id}"
                class="font-mono text-sm text-blue-600 hover:underline"
              >
                {session.id.slice(0, 8)}...
              </a>
            </td>
            <td class="p-4 text-sm text-gray-500">
              {session.user_id ?? (session.anon_id ? session.anon_id.slice(0, 8) + "..." : "-")}
            </td>
            <td class="p-4 text-sm text-gray-500" title={formatTimestamp(session.started_at)}>
              {formatRelativeTime(session.started_at)}
            </td>
            <td class="p-4 text-sm text-gray-500" title={formatTimestamp(session.last_event_at)}>
              {formatRelativeTime(session.last_event_at)}
            </td>
            <td class="p-4 text-sm font-medium">
              {session.event_count}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
