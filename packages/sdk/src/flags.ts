type FlagStore = Record<string, boolean>;

let flags: FlagStore = {};
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beacon:flags", ((e: CustomEvent<FlagStore>) => {
    flags = e.detail;
    listeners.forEach((fn) => fn());
  }) as EventListener);
}

export function isEnabled(key: string, fallback = false): boolean {
  return flags[key] ?? fallback;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAll(): FlagStore {
  return { ...flags };
}
