import { describe, it, expect, vi, beforeEach } from "vitest";

// Import flags module - need to handle the window event listener
async function importFlags() {
  vi.resetModules();
  return import("../src/flags");
}

describe("flags module", () => {
  describe("isEnabled", () => {
    it("returns false by default for unknown flag", async () => {
      const { isEnabled } = await importFlags();

      expect(isEnabled("unknown_flag")).toBe(false);
    });

    it("returns fallback value when flag not found", async () => {
      const { isEnabled } = await importFlags();

      expect(isEnabled("unknown_flag", true)).toBe(true);
    });

    it("returns flag value when flag exists", async () => {
      const { isEnabled } = await importFlags();

      // Simulate flags being set via event
      window.dispatchEvent(
        new CustomEvent("beacon:flags", {
          detail: { test_flag: true },
        }),
      );

      expect(isEnabled("test_flag")).toBe(true);
    });

    it("returns false when flag is explicitly false", async () => {
      const { isEnabled } = await importFlags();

      window.dispatchEvent(
        new CustomEvent("beacon:flags", {
          detail: { disabled_flag: false },
        }),
      );

      expect(isEnabled("disabled_flag")).toBe(false);
      // Fallback is ignored when flag is explicitly set
      expect(isEnabled("disabled_flag", true)).toBe(false);
    });
  });

  describe("subscribe", () => {
    it("invokes callback when flags change", async () => {
      const { subscribe } = await importFlags();
      const callback = vi.fn();

      subscribe(callback);

      window.dispatchEvent(
        new CustomEvent("beacon:flags", {
          detail: { new_flag: true },
        }),
      );

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("returns unsubscribe function", async () => {
      const { subscribe } = await importFlags();
      const callback = vi.fn();

      const unsubscribe = subscribe(callback);

      // First update should trigger
      window.dispatchEvent(
        new CustomEvent("beacon:flags", {
          detail: { flag1: true },
        }),
      );

      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second update should not trigger
      window.dispatchEvent(
        new CustomEvent("beacon:flags", {
          detail: { flag2: true },
        }),
      );

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("notifies multiple subscribers", async () => {
      const { subscribe } = await importFlags();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      subscribe(callback1);
      subscribe(callback2);

      window.dispatchEvent(
        new CustomEvent("beacon:flags", {
          detail: { flag: true },
        }),
      );

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAll", () => {
    it("returns empty object initially", async () => {
      const { getAll } = await importFlags();

      // Clear any existing flags
      window.dispatchEvent(
        new CustomEvent("beacon:flags", {
          detail: {},
        }),
      );

      expect(getAll()).toEqual({});
    });

    it("returns all current flags", async () => {
      const { getAll } = await importFlags();

      window.dispatchEvent(
        new CustomEvent("beacon:flags", {
          detail: { flag_a: true, flag_b: false, flag_c: true },
        }),
      );

      expect(getAll()).toEqual({
        flag_a: true,
        flag_b: false,
        flag_c: true,
      });
    });

    it("returns a copy (not the original)", async () => {
      const { getAll } = await importFlags();

      window.dispatchEvent(
        new CustomEvent("beacon:flags", {
          detail: { flag: true },
        }),
      );

      const flags1 = getAll();
      const flags2 = getAll();

      expect(flags1).toEqual(flags2);
      expect(flags1).not.toBe(flags2); // Different object reference
    });
  });
});
