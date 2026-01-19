import type { CoachProvider, CoachProviderInput } from "../types";
import { parseCoachOutput } from "../parseOutput";

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

  // Keep recent conversation (this is what makes it feel like an assistant)
  const conversation = input.contextPacket.recentConversation
    .slice(-10) // Last 10 messages max
    .map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));

  // Build a human-readable financial summary instead of raw JSON
  const parts: string[] = [];
  
  // Cashflow in plain English
  const cf = input.contextPacket.cashflow;
  if (cf) {
    const net = cf.netCents / 100;
    const income = cf.incomeCents / 100;
    const expenses = cf.expenseCents / 100;
    if (net < 0) {
      parts.push(`This month: $${income.toLocaleString()} income, $${expenses.toLocaleString()} spent, $${Math.abs(net).toLocaleString()} in the red.`);
    } else {
      parts.push(`This month: $${income.toLocaleString()} income, $${expenses.toLocaleString()} spent, $${net.toLocaleString()} surplus.`);
    }
  }

  // Top spending areas (brief)
  const cats = input.contextPacket.spendByCategory?.slice(0, 3);
  if (cats && cats.length > 0) {
    const catStr = cats.map(c => `${c.category} ($${(c.amountCents/100).toLocaleString()})`).join(", ");
    parts.push(`Top spending: ${catStr}.`);
  }

  // Upcoming bills (brief)
  const bills = input.contextPacket.upcomingBills?.slice(0, 3);
  if (bills && bills.length > 0) {
    const billStr = bills.map(b => b.name).join(", ");
    parts.push(`Upcoming bills: ${billStr}.`);
  }

  // Established facts from this session
  const facts = input.contextPacket.establishedFacts;
  if (facts && facts.length > 0) {
    parts.push(`User has shared: ${facts.join("; ")}.`);
  }

  // Foundation snapshot (key user info)
  const foundation = input.contextPacket.foundationSnapshot as Record<string, unknown> | null;
  if (foundation) {
    const foundationParts: string[] = [];
    if (foundation.monthlyIncomeCents) {
      foundationParts.push(`monthly income ~$${((foundation.monthlyIncomeCents as number) / 100).toLocaleString()}`);
    }
    if (foundation.primaryGoal) {
      foundationParts.push(`goal: ${foundation.primaryGoal}`);
    }
    if (foundationParts.length > 0) {
      parts.push(`Known about user: ${foundationParts.join(", ")}.`);
    }
  }

  const financialContext = parts.length > 0 
    ? parts.join(" ") 
    : "No financial data available yet.";

  // User's message is just their message - context goes in system or as a note
  const userPayload = input.message;

  // Append context as a brief system note, not in user message
  const systemWithContext = [
    input.systemPrompt,
    "",
    "---",
    "User's financial context:",
    financialContext,
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
      messages: [
        { role: "system", content: systemWithContext },
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

  return parseCoachOutput(content);
}

export function createGroqProvider(): CoachProvider {
  return {
    id: "groq",
    generate: async (input) => callGroq(input),
  };
}
