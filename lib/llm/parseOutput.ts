import { CoachOutputSchema, type CoachOutput } from "./schema";

type OutputCandidate = Partial<CoachOutput> & {
  profileUpdates?: CoachOutput["profileUpdates"];
  foundationUpdates?: CoachOutput["foundationUpdates"];
  transactionDrilldownRequest?: CoachOutput["transactionDrilldownRequest"];
  memoryDelta?: CoachOutput["memoryDelta"];
  memoryUpdates?: CoachOutput["memoryUpdates"];
};

const SECTION_HEADERS = [
  "summary",
  "next actions",
  "actions",
  "questions",
  "follow-ups",
  "follow up",
  "follow-up",
];

function isHeader(line: string): string | null {
  const normalized = line.trim().toLowerCase().replace(/:$/, "");
  if (!normalized) return null;
  return SECTION_HEADERS.includes(normalized) ? normalized : null;
}

function stripBullet(line: string): string {
  return line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
}

function extractSections(lines: string[]): {
  summary: string[];
  actions: string[];
  questions: string[];
} {
  let current: string | null = null;
  const summary: string[] = [];
  const actions: string[] = [];
  const questions: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = isHeader(line);
    if (header) {
      current = header;
      continue;
    }

    const bullet = stripBullet(line);
    if (!bullet) continue;

    if (current === "summary") summary.push(bullet);
    if (current === "next actions" || current === "actions") actions.push(bullet);
    if (current === "questions" || (current && current.startsWith("follow"))) questions.push(bullet);
  }

  return { summary, actions, questions };
}

function extractQuestionsFromText(_text: string): string[] {
  // DISABLED: This function was extracting questions the COACH asks the user
  // from the response text, then presenting them as options for the USER to send.
  // This created a nonsensical feedback loop. 
  // If the LLM doesn't provide explicit openQuestions, we show no follow-ups.
  return [];
}

function coerceOutput(
  candidate: OutputCandidate,
  assistantMessage: string,
  fallbackQuestions: string[]
): CoachOutput {
  const output: OutputCandidate = {
    assistantMessage,
    summaryBullets: Array.isArray(candidate.summaryBullets) ? candidate.summaryBullets : [],
    actions: Array.isArray(candidate.actions) ? candidate.actions : [],
    openQuestions: Array.isArray(candidate.openQuestions) ? candidate.openQuestions : fallbackQuestions,
    metricsUsed: Array.isArray(candidate.metricsUsed) ? candidate.metricsUsed : [],
  };

  if (candidate.profileUpdates) output.profileUpdates = candidate.profileUpdates;
  if (candidate.foundationUpdates) output.foundationUpdates = candidate.foundationUpdates;
  if (candidate.memoryDelta) output.memoryDelta = candidate.memoryDelta;
  if (candidate.memoryUpdates) output.memoryUpdates = candidate.memoryUpdates;
  if (candidate.transactionDrilldownRequest) {
    output.transactionDrilldownRequest = candidate.transactionDrilldownRequest;
  }

  return CoachOutputSchema.parse(output);
}

function extractJsonBlock(text: string): { json: OutputCandidate | null; cleaned: string } {
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  if (!match) return { json: null, cleaned: text };

  const raw = match[1]?.trim();
  if (!raw) return { json: null, cleaned: text };

  try {
    const parsed = JSON.parse(raw) as OutputCandidate;
    const cleaned = text.replace(match[0], "").trim();
    return { json: parsed, cleaned: cleaned || text };
  } catch {
    return { json: null, cleaned: text };
  }
}

export function parseCoachOutput(rawContent: string): CoachOutput {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return CoachOutputSchema.parse({
      assistantMessage: "I am ready when you are. Tell me what you want to focus on.",
      summaryBullets: [],
      actions: [],
      openQuestions: [],
      metricsUsed: [],
    });
  }

  try {
    const parsedJson = JSON.parse(trimmed) as OutputCandidate & { version?: number; blocks?: unknown[] };
    
    // Check for new block format (version: 1 + blocks array)
    if (parsedJson.version === 1 && Array.isArray(parsedJson.blocks)) {
      // Pass through the raw JSON as assistantMessage - the frontend will parse it
      return CoachOutputSchema.parse({
        assistantMessage: trimmed, // Keep the raw JSON for BlockRenderer
        summaryBullets: [],
        actions: [],
        openQuestions: Array.isArray(parsedJson.openQuestions) ? parsedJson.openQuestions : [],
        metricsUsed: [],
        profileUpdates: parsedJson.profileUpdates,
        foundationUpdates: parsedJson.foundationUpdates,
        memoryDelta: parsedJson.memoryDelta,
        memoryUpdates: parsedJson.memoryUpdates,
        transactionDrilldownRequest: parsedJson.transactionDrilldownRequest,
      });
    }
    
    const fallbackQuestions = extractQuestionsFromText(trimmed);
    const assistantMessage =
      typeof parsedJson.assistantMessage === "string" && parsedJson.assistantMessage.trim()
        ? parsedJson.assistantMessage
        : trimmed;
    return coerceOutput(parsedJson, assistantMessage, fallbackQuestions);
  } catch {
    // Fall through to text parsing.
  }

  const extracted = extractJsonBlock(trimmed);
  if (extracted.json) {
    // Check for block format within code block
    const jsonWithBlocks = extracted.json as OutputCandidate & { version?: number; blocks?: unknown[] };
    if (jsonWithBlocks.version === 1 && Array.isArray(jsonWithBlocks.blocks)) {
      // Reconstruct the JSON string for the block format
      const blockJson = JSON.stringify({ version: 1, blocks: jsonWithBlocks.blocks });
      return CoachOutputSchema.parse({
        assistantMessage: blockJson,
        summaryBullets: [],
        actions: [],
        openQuestions: Array.isArray(jsonWithBlocks.openQuestions) ? jsonWithBlocks.openQuestions : [],
        metricsUsed: [],
        profileUpdates: jsonWithBlocks.profileUpdates,
        foundationUpdates: jsonWithBlocks.foundationUpdates,
        memoryDelta: jsonWithBlocks.memoryDelta,
        memoryUpdates: jsonWithBlocks.memoryUpdates,
        transactionDrilldownRequest: jsonWithBlocks.transactionDrilldownRequest,
      });
    }
    
    const fallbackQuestions = extractQuestionsFromText(extracted.cleaned);
    return coerceOutput(extracted.json, extracted.cleaned, fallbackQuestions);
  }

  const lines = trimmed.split("\n");
  const sections = extractSections(lines);
  const fallbackQuestions = sections.questions.length ? sections.questions : extractQuestionsFromText(trimmed);

  return coerceOutput(
    {
      summaryBullets: sections.summary,
      actions: sections.actions,
      openQuestions: sections.questions.length ? sections.questions : undefined,
    },
    trimmed,
    fallbackQuestions
  );
}
