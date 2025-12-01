/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      colors: {
        rp: {
          base: "var(--rp-base)",
          surface: "var(--rp-surface)",
          overlay: "var(--rp-overlay)",
          muted: "var(--rp-muted)",
          subtle: "var(--rp-subtle)",
          text: "var(--rp-text)",
          love: "var(--rp-love)",
          gold: "var(--rp-gold)",
          rose: "var(--rp-rose)",
          pine: "var(--rp-pine)",
          foam: "var(--rp-foam)",
          iris: "var(--rp-iris)",
        },
      },
    },
  },
  plugins: [],
};
