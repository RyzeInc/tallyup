/**
 * Telemetry for coach response format tracking.
 * 
 * This tracks:
 * - Success/failure rates for block parsing
 * - Fallback usage patterns
 * - Provider-specific format compliance
 * 
 * Data is stored locally and can be exported for debugging.
 */

import type { FormatTelemetry } from "./blocks";

const TELEMETRY_KEY = "coach_format_telemetry";
const MAX_ENTRIES = 100;

export interface TelemetrySummary {
  totalResponses: number;
  blockFormatSuccess: number;
  markdownFallback: number;
  unknownFallback: number;
  successRate: number;
  byProvider: Record<string, {
    total: number;
    blockSuccess: number;
    successRate: number;
  }>;
  recentErrors: Array<{
    timestamp: number;
    provider: string;
    error: string;
  }>;
}

/**
 * Store a telemetry entry.
 */
export function recordFormatTelemetry(entry: FormatTelemetry): void {
  if (typeof window === "undefined") return;
  
  try {
    const stored = localStorage.getItem(TELEMETRY_KEY);
    const entries: FormatTelemetry[] = stored ? JSON.parse(stored) : [];
    
    // Add new entry at the beginning
    entries.unshift(entry);
    
    // Keep only the most recent entries
    const trimmed = entries.slice(0, MAX_ENTRIES);
    
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // Silently fail - telemetry shouldn't break the app
    console.warn("[telemetry] Failed to record:", e);
  }
}

/**
 * Get all telemetry entries.
 */
export function getTelemetryEntries(): FormatTelemetry[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(TELEMETRY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get a summary of telemetry data.
 */
export function getTelemetrySummary(): TelemetrySummary {
  const entries = getTelemetryEntries();
  
  const summary: TelemetrySummary = {
    totalResponses: entries.length,
    blockFormatSuccess: 0,
    markdownFallback: 0,
    unknownFallback: 0,
    successRate: 0,
    byProvider: {},
    recentErrors: [],
  };
  
  for (const entry of entries) {
    // Count by format
    if (entry.format === "blocks" && entry.blockParseSuccess) {
      summary.blockFormatSuccess++;
    } else if (entry.format === "markdown") {
      summary.markdownFallback++;
    } else {
      summary.unknownFallback++;
    }
    
    // Track by provider
    if (!summary.byProvider[entry.provider]) {
      summary.byProvider[entry.provider] = {
        total: 0,
        blockSuccess: 0,
        successRate: 0,
      };
    }
    
    const providerStats = summary.byProvider[entry.provider];
    providerStats.total++;
    if (entry.blockParseSuccess) {
      providerStats.blockSuccess++;
    }
    
    // Collect errors
    if (entry.parseError) {
      summary.recentErrors.push({
        timestamp: entry.timestamp,
        provider: entry.provider,
        error: entry.parseError,
      });
    }
  }
  
  // Calculate success rates
  if (summary.totalResponses > 0) {
    summary.successRate = summary.blockFormatSuccess / summary.totalResponses;
  }
  
  for (const provider of Object.keys(summary.byProvider)) {
    const stats = summary.byProvider[provider];
    if (stats.total > 0) {
      stats.successRate = stats.blockSuccess / stats.total;
    }
  }
  
  // Limit errors to most recent 10
  summary.recentErrors = summary.recentErrors.slice(0, 10);
  
  return summary;
}

/**
 * Clear all telemetry data.
 */
export function clearTelemetry(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TELEMETRY_KEY);
}

/**
 * Export telemetry data as JSON string.
 */
export function exportTelemetry(): string {
  const entries = getTelemetryEntries();
  const summary = getTelemetrySummary();
  
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    summary,
    entries,
  }, null, 2);
}

/**
 * Log telemetry summary to console (for debugging).
 */
export function logTelemetrySummary(): void {
  const summary = getTelemetrySummary();
  
  console.group("📊 Coach Format Telemetry");
  console.log(`Total responses: ${summary.totalResponses}`);
  console.log(`Block format success: ${summary.blockFormatSuccess} (${(summary.successRate * 100).toFixed(1)}%)`);
  console.log(`Markdown fallback: ${summary.markdownFallback}`);
  console.log(`Unknown fallback: ${summary.unknownFallback}`);
  
  console.group("By Provider:");
  for (const [provider, stats] of Object.entries(summary.byProvider)) {
    console.log(`  ${provider}: ${stats.blockSuccess}/${stats.total} (${(stats.successRate * 100).toFixed(1)}%)`);
  }
  console.groupEnd();
  
  if (summary.recentErrors.length > 0) {
    console.group("Recent Errors:");
    for (const error of summary.recentErrors) {
      console.log(`  [${new Date(error.timestamp).toLocaleString()}] ${error.provider}: ${error.error}`);
    }
    console.groupEnd();
  }
  
  console.groupEnd();
}
