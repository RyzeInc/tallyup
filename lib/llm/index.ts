import { createMockProvider } from "./providers/mock";
import { createGroqProvider } from "./providers/groq";
import { createCloudflareProvider } from "./providers/cloudflare";
import type { CoachProvider } from "./types";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true";
}

function resolveProviderName(): "mock" | "groq" | "cloudflare" {
  const raw = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  if (raw === "groq" || raw === "cloudflare") return raw;
  return "mock";
}

export function getCoachProvider(options?: { forceMock?: boolean }): {
  provider: CoachProvider;
  usesExternal: boolean;
  selected: "mock" | "groq" | "cloudflare";
} {
  const alphaCostGuard = parseBoolean(process.env.ALPHA_COST_GUARD, true);
  const llmEnabled = parseBoolean(process.env.LLM_ENABLED, false);

  if (options?.forceMock || alphaCostGuard || !llmEnabled) {
    return { provider: createMockProvider(), usesExternal: false, selected: "mock" };
  }

  const selected = resolveProviderName();

  if (selected === "groq") {
    return { provider: createGroqProvider(), usesExternal: true, selected };
  }

  if (selected === "cloudflare") {
    return { provider: createCloudflareProvider(), usesExternal: true, selected };
  }

  return { provider: createMockProvider(), usesExternal: false, selected: "mock" };
}
