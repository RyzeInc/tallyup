import type { CoachProvider, CoachProviderInput } from "../types";
import type { CoachOutput } from "../schema";
import { parseCoachOutput } from "../parseOutput";
import { buildCompactContext, buildConversationMessages, estimateTokens } from "../contextBuilder";
import { iterateChatCompletionStream } from "./sse";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.1-8b-instant";
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 900;

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

/**
 * Returns a parsed CoachOutput when `streaming` is false, or the raw streaming
 * Response when true. Kept as one function so both paths build an identical
 * request body and context.
 */
async function callGroq(
  input: CoachProviderInput,
  streaming: boolean
): Promise<CoachOutput | Response> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY.");

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const temperature = Math.min(Math.max(parseNumber(process.env.GROQ_TEMPERATURE, DEFAULT_TEMPERATURE), 0), 1);
  const maxTokens = Math.round(Math.max(parseNumber(process.env.GROQ_MAX_TOKENS, DEFAULT_MAX_TOKENS), 256));

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
    console.info(`[groq] model=${model} temp=${temperature} maxTokens=${maxTokens}`);
    console.info(`[groq] tokens est: system=${systemTokens} conv=${convTokens} msg=${msgTokens} total=${systemTokens + convTokens + msgTokens}`);
  }

  const requestInit = (stream: boolean): RequestInit => ({
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      stream,
      messages: [
        { role: "system", content: systemWithContext },
        ...conversation,
        { role: "user", content: input.message },
      ],
    }),
  });

  if (streaming) {
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, requestInit(true));
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Groq stream request failed: ${response.status} ${text}`);
    }
    return response;
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, requestInit(false));

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq request failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq response missing content.");

  return parseCoachOutput(content);
}

async function* streamGroq(input: CoachProviderInput): AsyncGenerator<string, void, void> {
  const response = (await callGroq(input, true)) as Response;
  yield* iterateChatCompletionStream(response);
}

export function createGroqProvider(): CoachProvider {
  return {
    id: "groq",
    generate: async (input) => (await callGroq(input, false)) as CoachOutput,
    generateStream: (input) => streamGroq(input),
  };
}
