// Hybrid haptics wrapper: Uses Native Capacitor API on mobile, falls back to Vibration API on web.
import { useCallback } from "react";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

export type HapticPattern =
  | "tap" | "success" | "warning" | "recording" | "send" | "reveal" | "phase" | "tick";

const WEB_PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: [15, 40, 25],
  warning: [40, 60, 40],
  recording: 20,
  send: [12, 30, 18],
  reveal: [10, 20, 10, 20, 30],
  phase: [8, 30, 8],
  tick: 6,
};

export async function haptic(p: HapticPattern) {
  // 1. NATIVE CAPACITOR HAPTICS (iOS/Android APK)
  if (Capacitor.isNativePlatform()) {
    try {
      switch (p) {
        case "tap":
        case "send":
        case "tick":
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case "phase":
        case "recording":
        case "reveal":
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case "warning":
          // Použijeme Heavy impact alebo Warning notifikáciu
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case "success":
          await Haptics.notification({ type: NotificationType.Success });
          break;
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
    nav.vibrate(WEB_PATTERNS[p]); 
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
