import { useEffect, useSyncExternalStore } from "react";
import { init, page, track, identify, type BeaconConfig, type EventProps } from "./beacon";
import { isEnabled, subscribe, getAll } from "./flags";

export { track, identify, page };
export type { BeaconConfig, EventProps };

interface BeaconProviderProps {
  children: React.ReactNode;
  config: BeaconConfig;
}

export function BeaconProvider({ children, config }: BeaconProviderProps) {
  useEffect(() => {
    init(config);
  }, [config.url, config.projectId]);

  return children;
}

export function usePageView(deps: unknown[] = []) {
  useEffect(() => {
    page();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useFlag(key: string, fallback = false): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isEnabled(key, fallback),
    () => fallback
  );
}

export function useFlags(): Record<string, boolean> {
  return useSyncExternalStore(subscribe, getAll, () => ({}));
}

export function useTrack() {
  return track;
}
