import { createMockProvider } from "./providers/mock";
import { createGroqProvider } from "./providers/groq";
import { createCloudflareProvider } from "./providers/cloudflare";
import { createOpenAIProvider } from "./providers/openai";
import type { CoachProvider } from "./types";

export type ProviderName = "mock" | "groq" | "cloudflare" | "openai";

export type ProviderResolution = {
  provider: CoachProvider;
  usesExternal: boolean;
  selected: ProviderName;
  /**
   * Why the mock provider was chosen, when it was not the explicit request.
   * Surfaced so a deployment that is silently serving canned responses is
   * diagnosable instead of looking like a broken model.
   */
  mockReason?: "forced" | "cost-guard" | "disabled" | "missing-credentials";
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

function resolveProviderName(): ProviderName {
  const raw = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  if (raw === "groq" || raw === "cloudflare" || raw === "openai") return raw;
  return "mock";
}

/** Whether the credentials a given provider needs are actually present. */
function hasCredentials(name: ProviderName): boolean {
  switch (name) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "groq":
      return !!process.env.GROQ_API_KEY;
    case "cloudflare":
      return !!process.env.CLOUDFLARE_ACCOUNT_ID && !!process.env.CLOUDFLARE_API_TOKEN;
    case "mock":
      return true;
  }
}

function mock(reason: ProviderResolution["mockReason"]): ProviderResolution {
  return {
    provider: createMockProvider(),
    usesExternal: false,
    selected: "mock",
    mockReason: reason,
  };
}

/**
 * Resolve the coach LLM provider.
 *
 * Defaults changed deliberately: ALPHA_COST_GUARD used to default to `true`
 * and LLM_ENABLED to `false`, so any deployment that did not set BOTH
 * variables served canned mock responses while looking fully wired. The guard
 * now only engages when explicitly switched on, and an unset LLM_PROVIDER (or
 * missing credentials) is what selects the mock — a condition the caller can
 * actually detect via `mockReason`.
 */
export function getCoachProvider(options?: { forceMock?: boolean }): ProviderResolution {
  if (options?.forceMock) return mock("forced");

  // Explicit opt-out switches. Both must be *set* to disable; absence no
  // longer silently disables the coach.
  if (parseBoolean(process.env.ALPHA_COST_GUARD, false)) return mock("cost-guard");
  if (!parseBoolean(process.env.LLM_ENABLED, true)) return mock("disabled");

  const selected = resolveProviderName();
  if (selected === "mock") return mock("disabled");

  if (!hasCredentials(selected)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[llm] LLM_PROVIDER="${selected}" but its credentials are missing; falling back to mock.`
      );
    }
    return mock("missing-credentials");
  }

  if (selected === "groq") {
    return { provider: createGroqProvider(), usesExternal: true, selected };
  }
  if (selected === "cloudflare") {
    return { provider: createCloudflareProvider(), usesExternal: true, selected };
  }
  return { provider: createOpenAIProvider(), usesExternal: true, selected };
}
