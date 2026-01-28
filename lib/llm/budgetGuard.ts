export const GLOBAL_USAGE_USER_ID = "__global__";

// Default rate limits to prevent runaway costs
// Set to 0 in env vars to disable limits (not recommended for production)
const DEFAULT_USER_MAX = 50;    // Max requests per user per day
const DEFAULT_GLOBAL_MAX = 5000; // Max requests globally per day

function parseLimit(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function getDailyCaps(): { userMax: number; globalMax: number } {
  return {
    userMax: parseLimit(process.env.LLM_DAILY_USER_MAX, DEFAULT_USER_MAX),
    globalMax: parseLimit(process.env.LLM_DAILY_GLOBAL_MAX, DEFAULT_GLOBAL_MAX),
  };
}

export function evaluateBudget(nextUserCalls: number, nextGlobalCalls: number): {
  allowed: boolean;
  reason?: string;
} {
  const { userMax, globalMax } = getDailyCaps();

  if (userMax > 0 && nextUserCalls > userMax) {
    return { allowed: false, reason: "Per-user daily coaching cap reached." };
  }

  if (globalMax > 0 && nextGlobalCalls > globalMax) {
    return { allowed: false, reason: "Global daily coaching cap reached." };
  }

  return { allowed: true };
}

export function formatDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
