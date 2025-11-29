<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Beacon Dashboard</title>
</svelte:head>

<div class="space-y-8">
  <h2 class="text-2xl font-semibold">Overview</h2>
  
  <div class="grid grid-cols-3 gap-6">
    <div class="bg-white rounded-lg shadow p-6">
      <div class="text-sm text-gray-500">Events (7d)</div>
      <div class="text-3xl font-bold">{data.eventCount.toLocaleString()}</div>
    </div>
    
    <div class="bg-white rounded-lg shadow p-6">
      <div class="text-sm text-gray-500">Sessions (7d)</div>
      <div class="text-3xl font-bold">{data.sessionCount.toLocaleString()}</div>
    </div>
    
    <div class="bg-white rounded-lg shadow p-6">
      <div class="text-sm text-gray-500">Active Flags</div>
      <div class="text-3xl font-bold">{data.flagCount}</div>
    </div>
  </div>
  
  <div class="bg-white rounded-lg shadow">
    <div class="p-4 border-b">
      <h3 class="font-semibold">Recent Events</h3>
    </div>
    <div class="p-4">
      {#if data.recentEvents.length === 0}
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
            {#each data.recentEvents as event}
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
