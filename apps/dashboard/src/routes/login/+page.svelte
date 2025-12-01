<script lang="ts">
  import { enhance } from "$app/forms";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-rp-base">
  <div class="w-full max-w-md p-8 bg-rp-surface rounded-lg border border-rp-overlay">
    <h1 class="text-2xl font-bold text-rp-iris mb-6 text-center">Beacon</h1>
    <h2 class="text-lg text-rp-text mb-6 text-center">Sign in to your account</h2>

    {#if form?.error}
      <div class="mb-4 p-3 bg-rp-love/10 border border-rp-love rounded text-rp-love text-sm">
        {form.error}
      </div>
    {/if}

    <form method="POST" use:enhance class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-rp-subtle mb-1">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          autocomplete="email"
          required
          class="w-full px-3 py-2 bg-rp-base border border-rp-overlay rounded text-rp-text focus:outline-none focus:border-rp-iris"
        />
      </div>

      <div>
        <label for="password" class="block text-sm font-medium text-rp-subtle mb-1">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          autocomplete="current-password"
          required
          class="w-full px-3 py-2 bg-rp-base border border-rp-overlay rounded text-rp-text focus:outline-none focus:border-rp-iris"
        />
      </div>

      <button
        type="submit"
        class="w-full py-2 px-4 bg-rp-iris text-rp-base rounded font-medium hover:bg-rp-iris/90 transition-colors"
      >
        Sign in
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-rp-subtle">
      Don't have an account?
      <a href="/register" class="text-rp-iris hover:underline">Register</a>
    </p>
  </div>
</div>
