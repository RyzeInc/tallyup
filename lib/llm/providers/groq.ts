import type { CoachProvider, CoachProviderInput } from "../types";
import { CoachOutputSchema } from "../schema";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.1-8b-instant";

async function callGroq(input: CoachProviderInput) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY.");

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            message: input.message,
            contextPacket: input.contextPacket,
          }),
        },
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
