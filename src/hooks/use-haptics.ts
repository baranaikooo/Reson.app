// Tiny haptics wrapper. Silent fallback when Vibration API is unavailable.
import { useCallback } from "react";

export type HapticPattern =
  | "tap"
  | "success"
  | "warning"
  | "recording"
  | "send"
  | "reveal"
  | "phase"
  | "tick";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [15, 40, 25],
  warning: [40, 60, 40],
  recording: 20,
  send: [12, 30, 18],
  reveal: [10, 20, 10, 20, 30],
  phase: [8, 30, 8],
  tick: 6,
};

export function haptic(p: HapticPattern) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(PATTERNS[p]);
  } catch {
    /* ignore */
  }
}

export function useHaptic() {
  return useCallback((p: HapticPattern) => haptic(p), []);
}
