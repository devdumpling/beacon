<script lang="ts">
  import "../app.css";
  import { PUBLIC_ZERO_SERVER } from "$env/static/public";
  import { createZero } from "$lib/zero/client.svelte";

  let { children } = $props();

  // Initialize Zero client (SSR disabled in +layout.ts)
  createZero("dashboard-admin", PUBLIC_ZERO_SERVER || "http://localhost:4848");
</script>

<div class="min-h-screen flex">
  <aside class="w-64 bg-gray-900 text-white p-4">
    <h1 class="text-xl font-bold mb-8">Beacon</h1>
    <nav class="space-y-2">
      <a href="/" class="block px-3 py-2 rounded hover:bg-gray-800">Overview</a>
      <a href="/events" class="block px-3 py-2 rounded hover:bg-gray-800">Events</a>
      <a href="/sessions" class="block px-3 py-2 rounded hover:bg-gray-800">Sessions</a>
      <a href="/flags" class="block px-3 py-2 rounded hover:bg-gray-800">Flags</a>
    </nav>
  </aside>

  <main class="flex-1 p-8">
    {@render children()}
  </main>
</div>
