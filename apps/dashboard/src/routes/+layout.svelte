<script lang="ts">
  import "../app.css";
  import { PUBLIC_ZERO_SERVER } from "$env/static/public";
  import { createZero } from "$lib/zero/client.svelte";

  let { children } = $props();

  // Initialize Zero client (SSR disabled in +layout.ts)
  createZero("dashboard-admin", PUBLIC_ZERO_SERVER || "http://localhost:4848");
</script>

<div class="min-h-screen flex bg-rp-base">
  <aside class="w-64 bg-rp-surface text-rp-text p-4 border-r border-rp-overlay">
    <h1 class="text-xl font-bold mb-8 text-rp-iris">Beacon</h1>
    <nav class="space-y-2">
      <a href="/" class="block px-3 py-2 rounded text-rp-subtle hover:bg-rp-overlay hover:text-rp-text">Overview</a>
      <a href="/events" class="block px-3 py-2 rounded text-rp-subtle hover:bg-rp-overlay hover:text-rp-text">Events</a>
      <a href="/sessions" class="block px-3 py-2 rounded text-rp-subtle hover:bg-rp-overlay hover:text-rp-text">Sessions</a>
      <a href="/flags" class="block px-3 py-2 rounded text-rp-subtle hover:bg-rp-overlay hover:text-rp-text">Flags</a>
    </nav>
  </aside>

  <main class="flex-1 p-8">
    {@render children()}
  </main>
</div>
