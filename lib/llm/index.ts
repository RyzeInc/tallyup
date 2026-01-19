import { createMockProvider } from "./providers/mock";
import { createGroqProvider } from "./providers/groq";
import { createCloudflareProvider } from "./providers/cloudflare";
import { createOpenAIProvider } from "./providers/openai";
import type { CoachProvider } from "./types";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true";
}

function resolveProviderName(): "mock" | "groq" | "cloudflare" | "openai" {
  const raw = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  if (raw === "groq" || raw === "cloudflare" || raw === "openai") return raw;
  return "mock";
}

export function getCoachProvider(options?: { forceMock?: boolean }): {
  provider: CoachProvider;
  usesExternal: boolean;
  selected: "mock" | "groq" | "cloudflare" | "openai";
} {
  const alphaCostGuard = parseBoolean(process.env.ALPHA_COST_GUARD, true);
  const llmEnabled = parseBoolean(process.env.LLM_ENABLED, false);

  // Debug: log what we're seeing
  console.info(`[getCoachProvider] ALPHA_COST_GUARD="${process.env.ALPHA_COST_GUARD}" => ${alphaCostGuard}`);
  console.info(`[getCoachProvider] LLM_ENABLED="${process.env.LLM_ENABLED}" => ${llmEnabled}`);
  console.info(`[getCoachProvider] LLM_PROVIDER="${process.env.LLM_PROVIDER}"`);
  console.info(`[getCoachProvider] forceMock=${options?.forceMock}`);

  if (options?.forceMock || alphaCostGuard || !llmEnabled) {
    console.info(`[getCoachProvider] Using MOCK because: forceMock=${options?.forceMock}, alphaCostGuard=${alphaCostGuard}, llmEnabled=${llmEnabled}`);
    return { provider: createMockProvider(), usesExternal: false, selected: "mock" };
  }

  const selected = resolveProviderName();

  if (selected === "groq") {
    return { provider: createGroqProvider(), usesExternal: true, selected };
  }

  if (selected === "cloudflare") {
    return { provider: createCloudflareProvider(), usesExternal: true, selected };
  }

  if (selected === "openai") {
    return { provider: createOpenAIProvider(), usesExternal: true, selected };
  }

  return { provider: createMockProvider(), usesExternal: false, selected: "mock" };
}
