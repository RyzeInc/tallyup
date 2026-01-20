import type { CoachProvider, CoachProviderInput } from "../types";
import { parseCoachOutput } from "../parseOutput";
import { buildCompactContext, buildConversationMessages, estimateTokens } from "../contextBuilder";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 900;

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

async function callOpenAI(input: CoachProviderInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY.");

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const temperature = Math.min(Math.max(parseNumber(process.env.OPENAI_TEMPERATURE, DEFAULT_TEMPERATURE), 0), 1);
  const maxTokens = Math.round(Math.max(parseNumber(process.env.OPENAI_MAX_TOKENS, DEFAULT_MAX_TOKENS), 256));

  // Build compact context with intent gating
  const intent = input.contextPacket.intent ?? undefined;
  const compactContext = buildCompactContext(input.contextPacket, { intent });
  
  // Only last 4 messages (summarize-and-replace)
  const conversation = buildConversationMessages(input.contextPacket, 4);

  // System prompt with context
  const systemWithContext = [
    input.systemPrompt,
    "",
    "---",
    "STATE:",
    compactContext,
  ].join("\n");

  // Log token estimates
  if (process.env.COACH_DEBUG === "true") {
    const systemTokens = estimateTokens(systemWithContext);
    const convTokens = estimateTokens(conversation.map(m => m.content).join(" "));
    const msgTokens = estimateTokens(input.message);
    console.info(`[openai] model=${model} temp=${temperature} maxTokens=${maxTokens}`);
    console.info(`[openai] tokens est: system=${systemTokens} conv=${convTokens} msg=${msgTokens} total=${systemTokens + convTokens + msgTokens}`);
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemWithContext },
        ...conversation,
        { role: "user", content: input.message },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI response missing content.");

  return parseCoachOutput(content);
}

export function createOpenAIProvider(): CoachProvider {
  return {
    id: "openai",
    generate: async (input) => callOpenAI(input),
  };
}
