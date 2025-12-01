<script lang="ts">
  import "../app.css";
  import { PUBLIC_ZERO_SERVER } from "$env/static/public";
  import { createZero } from "$lib/zero/client.svelte";
  import { enhance } from "$app/forms";
  import { untrack } from "svelte";
  import type { LayoutData } from "./$types";
  import type { Snippet } from "svelte";

  let { children, data }: { children: Snippet; data: LayoutData } = $props();

  // Derive user reactively for template usage
  const user = $derived(data.user);

  // Track Zero initialization state - gates children rendering
  let zeroReady = $state(false);

  // Initialize Zero synchronously during script execution for direct page loads
  // Using untrack because this intentionally captures the initial value
  untrack(() => {
    if (data.user) {
      createZero(data.user.id, PUBLIC_ZERO_SERVER || "http://localhost:4848");
      zeroReady = true;
    }
  });

  // Handle user changes after initial mount (e.g., login redirect)
  // Effect runs after initial render, but children are gated by zeroReady
  $effect(() => {
    if (data.user && !zeroReady) {
      createZero(data.user.id, PUBLIC_ZERO_SERVER || "http://localhost:4848");
      zeroReady = true;
    }
  });
</script>

{#if user}
  {#if zeroReady}
    <div class="min-h-screen flex bg-rp-base">
      <aside class="w-64 bg-rp-surface text-rp-text p-4 border-r border-rp-overlay flex flex-col">
        <h1 class="text-xl font-bold mb-8 text-rp-iris">Beacon</h1>
        <nav class="space-y-2 flex-1">
          <a href="/" class="block px-3 py-2 rounded text-rp-subtle hover:bg-rp-overlay hover:text-rp-text">Overview</a>
          <a href="/events" class="block px-3 py-2 rounded text-rp-subtle hover:bg-rp-overlay hover:text-rp-text">Events</a>
          <a href="/sessions" class="block px-3 py-2 rounded text-rp-subtle hover:bg-rp-overlay hover:text-rp-text">Sessions</a>
          <a href="/flags" class="block px-3 py-2 rounded text-rp-subtle hover:bg-rp-overlay hover:text-rp-text">Flags</a>
        </nav>
        <div class="border-t border-rp-overlay pt-4 mt-4">
          <p class="text-sm text-rp-subtle mb-2 truncate">{user.email}</p>
          <form method="POST" action="/logout" use:enhance>
            <button
              type="submit"
              class="w-full text-left px-3 py-2 rounded text-rp-subtle hover:bg-rp-overlay hover:text-rp-text text-sm"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main class="flex-1 p-8">
        {@render children()}
      </main>
    </div>
  {:else}
    <div class="min-h-screen flex items-center justify-center bg-rp-base">
      <span class="text-rp-muted">Initializing...</span>
    </div>
  {/if}
{:else}
  {@render children()}
{/if}
