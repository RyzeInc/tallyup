import type { CoachProvider, CoachProviderInput } from "../types";
import { CoachOutputSchema } from "../schema";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 900;

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

async function callGroq(input: CoachProviderInput) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY.");

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  const temperature = Math.min(Math.max(parseNumber(process.env.GROQ_TEMPERATURE, DEFAULT_TEMPERATURE), 0), 1);
  const maxTokens = Math.round(Math.max(parseNumber(process.env.GROQ_MAX_TOKENS, DEFAULT_MAX_TOKENS), 256));

  if (process.env.COACH_DEBUG === "true") {
    console.info(`[groq] model=${model} temp=${temperature} maxTokens=${maxTokens}`);
  }

  const conversation = input.contextPacket.recentConversation.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

  const userPayload = [
    "User message:",
    input.message,
    "",
    "Context packet (JSON):",
    JSON.stringify(input.contextPacket),
  ].join("\n");

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.systemPrompt },
        ...conversation,
        { role: "user", content: userPayload },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq request failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>; 
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq response missing content.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq response was not valid JSON.");
  }

  return CoachOutputSchema.parse(parsed);
}

export function createGroqProvider(): CoachProvider {
  return {
    id: "groq",
    generate: async (input) => callGroq(input),
  };
}
