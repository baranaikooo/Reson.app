// Hybrid haptics wrapper: Uses Native Capacitor API on mobile, falls back to Vibration API on web.
import { useCallback } from "react";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

export type HapticPattern =
  | "tap"
  | "success"
  | "warning"
  | "error"
  | "destructive"
  | "recording"
  | "send"
  | "reveal"
  | "phase"
  | "tick"
  | "medium"
  | "heavy";

const WEB_PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [15, 40, 25],
  warning: [40, 60, 40],
  error: [50, 50, 50],
  destructive: [50, 50, 50],
  recording: 20,
  send: [12, 30, 18],
  reveal: [10, 20, 10, 20, 30],
  phase: [8, 30, 8],
  tick: 6,
  medium: 20,
  heavy: [40, 40, 40],
};

export async function haptic(p: HapticPattern) {
  const profile = typeof window !== "undefined" ? window.localStorage.getItem("reson_haptic_profile") || "TACTILE" : "TACTILE";
  if (profile === "STEALTH") return;

  // 1. NATIVE CAPACITOR HAPTICS (iOS/Android APK)
  if (Capacitor.isNativePlatform()) {
    try {
      if (profile === "MECHANICAL") {
        // Boost everything to Heavy or Error/Warning notifications
        switch (p) {
          case "error":
          case "destructive":
            await Haptics.notification({ type: NotificationType.Error });
            break;
          case "success":
            await Haptics.notification({ type: NotificationType.Success });
            break;
          case "warning":
            await Haptics.notification({ type: NotificationType.Warning });
            break;
          default:
            await Haptics.impact({ style: ImpactStyle.Heavy });
            break;
        }
      } else {
        // TACTILE (Standard tactile feedback)
        switch (p) {
          case "tap":
          case "send":
          case "tick":
            await Haptics.impact({ style: ImpactStyle.Light });
            break;
          case "phase":
          case "recording":
          case "reveal":
          case "medium":
            await Haptics.impact({ style: ImpactStyle.Medium });
            break;
          case "heavy":
            await Haptics.impact({ style: ImpactStyle.Heavy });
            break;
          case "warning":
            await Haptics.notification({ type: NotificationType.Warning });
            break;
          case "error":
          case "destructive":
            await Haptics.notification({ type: NotificationType.Error });
            break;
          case "success":
            await Haptics.notification({ type: NotificationType.Success });
            break;
        }
      }
      return; // Ak natívna haptika zbehla, nepokračujeme na webový fallback
    } catch (e) {
      console.warn("[Haptics] Native API failed, falling back to web vibration", e);
    }
  }

  // 2. GRACEFUL DEGRADATION: WEB VIBRATION API FALLBACK
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;

  try {
    let pattern = WEB_PATTERNS[p];
    if (profile === "MECHANICAL") {
      if (typeof pattern === "number") {
        pattern = Math.max(60, pattern * 3);
      } else {
        pattern = pattern.map((v) => Math.max(60, v * 3));
      }
    }
    nav.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export function useHaptic() {
  return useCallback((p: HapticPattern) => {
    // Calling async function in background without awaiting in the hook
    haptic(p).catch(() => {});
  }, []);
}
