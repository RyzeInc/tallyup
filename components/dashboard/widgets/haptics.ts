"use client";

/**
 * Haptic feedback utility for mobile devices
 * 
 * Uses the Vibration API where available, with fallbacks for iOS Safari
 * that uses haptic feedback via navigator.vibrate or WebKit workarounds.
 */

type HapticStyle = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

// Vibration patterns in milliseconds
const HAPTIC_PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  selection: 5,
  success: [10, 50, 10],
  warning: [20, 50, 20],
  error: [30, 50, 30, 50, 30],
};

/**
 * Check if haptic feedback is available
 */
export function isHapticAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return "vibrate" in navigator;
}

/**
 * Trigger haptic feedback
 * 
 * @param style - The style of haptic feedback
 * @returns true if haptic was triggered, false otherwise
 */
export function triggerHaptic(style: HapticStyle = "light"): boolean {
  if (!isHapticAvailable()) return false;
  
  try {
    const pattern = HAPTIC_PATTERNS[style];
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/**
 * Trigger haptic on long press start (for drag initiation)
 */
export function hapticDragStart(): void {
  triggerHaptic("medium");
}

/**
 * Trigger haptic during drag (subtle feedback on position change)
 */
export function hapticDragMove(): void {
  triggerHaptic("selection");
}

/**
 * Trigger haptic on drop
 */
export function hapticDrop(): void {
  triggerHaptic("light");
}

/**
 * Trigger haptic for widget resize
 */
export function hapticResize(): void {
  triggerHaptic("selection");
}

/**
 * Trigger haptic for widget toggle
 */
export function hapticToggle(): void {
  triggerHaptic("light");
}
