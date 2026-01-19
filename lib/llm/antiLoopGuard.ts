/**
 * Anti-Loop Response Guard
 * 
 * This module provides deterministic control over coach responses to prevent:
 * 1. Asking the same question twice
 * 2. Ignoring information the user already provided
 * 3. Repeating the same summary every turn
 * 4. Failing to provide value while collecting information
 * 
 * Key principles:
 * - Every turn MUST provide at least one insight or action
 * - Questions are only asked if the slot is not yet filled
 * - Recaps only mention NEW information, not the full history
 * - If user expresses frustration, switch to value-only mode
 */

import type { CoachOutput } from "./schema";
import type { CoachContextPacket } from "./types";
import {
  type SlotLedger,
  createEmptyLedger,
  pickNextQuestion,
  markSlotAsked,
  markSlotAnswered,
  syncLedgerWithFoundation,
  detectAnsweredSlots,
  detectRepetitionFrustration,
} from "../coach/slotLedger";

const FRUSTRATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes without questions after frustration

/**
 * Generate a delta-based insight from the context packet
 */
function generateDeltaInsight(packet: CoachContextPacket): string | null {
  // Check for anomalies (spend spikes)
  if (packet.anomalies.length > 0) {
    const top = packet.anomalies[0];
    const direction = top.deltaCents > 0 ? "up" : "down";
    const absAmount = Math.abs(top.deltaCents) / 100;
    return `${top.category} is ${direction} $${absAmount.toFixed(0)} compared to your baseline — ${top.reason}.`;
  }

  // Check cashflow status
  if (packet.cashflow.netCents < 0) {
    const deficit = Math.abs(packet.cashflow.netCents) / 100;
    return `You're running a $${deficit.toFixed(0)} deficit so far this month. Let's find the leak.`;
  }

  if (packet.cashflow.netCents > 0 && packet.cashflow.incomeCents > 0) {
    const surplus = packet.cashflow.netCents / 100;
    const rate = (packet.cashflow.netCents / packet.cashflow.incomeCents) * 100;
    return `You're ${surplus.toFixed(0)} ahead this month (${rate.toFixed(0)}% save rate). Nice work.`;
  }

  // Check upcoming bills
  if (packet.upcomingBills.length > 0) {
    const upcoming = packet.upcomingBills.slice(0, 3);
    const total = upcoming.reduce((sum, b) => sum + (b.expectedAmountCents ?? 0), 0) / 100;
    if (total > 0) {
      return `You have $${total.toFixed(0)} in bills coming up in the next 30 days.`;
    }
  }

  return null;
}

/**
 * Generate a simple next action from context
 */
function generateNextAction(packet: CoachContextPacket): string {
  if (packet.anomalies.length > 0) {
    return `Review your ${packet.anomalies[0].category} transactions to understand the spike.`;
  }

  if (packet.cashflow.netCents < 0) {
    return "Identify one discretionary expense you can cut this week.";
  }

  if (packet.upcomingBills.length > 0) {
    return `Confirm ${packet.upcomingBills[0].name} is covered before it hits.`;
  }

  if (packet.spendByCategory.length > 0) {
    return `Set a cap for ${packet.spendByCategory[0].category} for the rest of the month.`;
  }

  return "Track your next 3 expenses to build momentum.";
}

/**
 * Check if the response is stuck repeating itself
 */
function isRepeatingLastResponse(
  newMessage: string,
  packet: CoachContextPacket
): boolean {
  const lastAssistant = [...packet.recentConversation]
    .reverse()
    .find((entry) => entry.role === "assistant");
  
  if (!lastAssistant) return false;

  // Check for exact match
  if (lastAssistant.content.trim() === newMessage.trim()) return true;

  // Check for high similarity (same opening)
  const newOpening = newMessage.slice(0, 100).toLowerCase();
  const lastOpening = lastAssistant.content.slice(0, 100).toLowerCase();
  if (newOpening === lastOpening) return true;

  return false;
}

/**
 * Extract what facts were just provided in the latest user message
 */
function extractNewFacts(
  userMessage: string
): string[] {
  const facts: string[] = [];
  const lower = userMessage.toLowerCase();

  // Income
  const incomeMatch = userMessage.match(/\$?([\d,]+(?:\.\d+)?)\s*(?:k)?\s*(?:per|a|\/)\s*(?:month|mo)/i);
  if (incomeMatch) {
    let amount = parseFloat(incomeMatch[1].replace(/,/g, ""));
    if (userMessage.toLowerCase().includes("k")) amount *= 1000;
    facts.push(`Monthly income: $${amount.toLocaleString()}`);
  }

  // Pay cadence
  if (/biweekly|bi-weekly/i.test(lower)) facts.push("Pay cadence: biweekly");
  else if (/weekly/i.test(lower) && !/biweekly/i.test(lower)) facts.push("Pay cadence: weekly");
  else if (/monthly/i.test(lower)) facts.push("Pay cadence: monthly");
  else if (/semi.?monthly|twice a month/i.test(lower)) facts.push("Pay cadence: semimonthly");

  // No debt
  if (/no\s+debt|debt.?free/i.test(lower)) facts.push("No debts besides mortgage");

  // Investment accounts
  const rothMatch = userMessage.match(/(\$?[\d,]+(?:\.\d+)?)\s*(?:k)?\s*(?:in\s+)?(?:my\s+)?(?:roth|ira)/i);
  if (rothMatch) {
    let amount = parseFloat(rothMatch[1].replace(/[$,]/g, ""));
    if (rothMatch[0].toLowerCase().includes("k")) amount *= 1000;
    facts.push(`Roth IRA: $${amount.toLocaleString()}`);
  }

  const brokerageMatch = userMessage.match(/(\$?[\d,]+(?:\.\d+)?)\s*(?:k)?\s*(?:in\s+)?(?:my\s+)?(?:robinhood|brokerage|investment)/i);
  if (brokerageMatch) {
    let amount = parseFloat(brokerageMatch[1].replace(/[$,]/g, ""));
    if (brokerageMatch[0].toLowerCase().includes("k")) amount *= 1000;
    facts.push(`Brokerage: $${amount.toLocaleString()}`);
  }

  // Mortgage
  const mortgageMatch = userMessage.match(/mortgage[^$]*\$?([\d,]+(?:\.\d+)?)\s*(?:k)?/i);
  if (mortgageMatch) {
    let amount = parseFloat(mortgageMatch[1].replace(/,/g, ""));
    if (mortgageMatch[0].toLowerCase().includes("k")) amount *= 1000;
    facts.push(`Mortgage: $${amount.toLocaleString()}/month`);
  }

  // Due date
  const dueDayMatch = userMessage.match(/(?:due|on)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?/i);
  if (dueDayMatch && lower.includes("mortgage")) {
    facts.push(`Mortgage due: ${dueDayMatch[1]}${getOrdinalSuffix(parseInt(dueDayMatch[1]))}`);
  }

  return facts;
}

function getOrdinalSuffix(n: number): string {
  const r = n % 100;
  if (r >= 11 && r <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

export type GuardResult = {
  output: CoachOutput;
  slotLedger: SlotLedger;
  establishedFacts: string[];
  frustrationDetectedAt: number | null;
};

/**
 * Apply anti-loop guards to coach output
 */
export function applyAntiLoopGuards(
  output: CoachOutput,
  input: {
    userMessage: string;
    contextPacket: CoachContextPacket;
  }
): GuardResult {
  const { userMessage, contextPacket } = input;
  const now = Date.now();

  // Initialize or get existing ledger
  let ledger: SlotLedger = contextPacket.slotLedger
    ? { ...contextPacket.slotLedger }
    : createEmptyLedger();

  // Sync ledger with foundation data
  ledger = syncLedgerWithFoundation(
    ledger,
    contextPacket.foundationSnapshot as Record<string, unknown> | null,
    now
  );

  // Detect and mark slots that were just answered
  const answeredSlots = detectAnsweredSlots(userMessage);
  for (const slot of answeredSlots) {
    ledger = markSlotAnswered(ledger, slot, now);
  }

  // Extract new facts from user message
  const newFacts = extractNewFacts(userMessage);
  const existingFacts = contextPacket.establishedFacts ?? [];
  const allFacts = [...existingFacts, ...newFacts];
  // Keep last 20 facts
  const establishedFacts = allFacts.slice(-20);

  // Detect frustration
  const isFrustrated = detectRepetitionFrustration(userMessage);
  let frustrationDetectedAt = contextPacket.frustrationDetectedAt ?? null;
  if (isFrustrated) {
    frustrationDetectedAt = now;
  }

  // Check if we're in frustration cooldown (no questions mode)
  const inFrustrationCooldown =
    frustrationDetectedAt !== null &&
    now - frustrationDetectedAt < FRUSTRATION_COOLDOWN_MS;

  // Check if response is repeating
  const isRepeating = isRepeatingLastResponse(output.assistantMessage, contextPacket);

  // Generate a guaranteed insight and action
  const deltaInsight = generateDeltaInsight(contextPacket);
  const nextAction = generateNextAction(contextPacket);

  // Determine if we should ask a question
  const shouldAskQuestion = !inFrustrationCooldown && !isFrustrated;
  
  // Get the next question if we should ask one
  const nextQuestion = shouldAskQuestion ? pickNextQuestion(ledger, now) : null;

  // Build the improved response
  let improvedMessage = output.assistantMessage;
  let improvedActions = output.actions.slice(0, 2);
  let improvedQuestions = output.openQuestions.slice(0, 1);

  // If frustrated, acknowledge and provide value without questions
  if (isFrustrated) {
    const valueMessage = [
      "I hear you — let me focus on what's useful right now.",
      deltaInsight ?? "Based on your data:",
      nextAction,
    ].filter(Boolean).join(" ");
    
    improvedMessage = valueMessage;
    improvedActions = [nextAction];
    improvedQuestions = [];
  }
  // If repeating, break the loop with a different approach
  else if (isRepeating) {
    const breakLoopMessage = [
      newFacts.length > 0
        ? `Got it — ${newFacts.join(", ")}.`
        : "Thanks for that.",
      deltaInsight ?? `Here's what stands out: ${nextAction}`,
      nextQuestion
        ? `One more thing that would help: ${nextQuestion.question}`
        : "What would you like to tackle first?",
    ].filter(Boolean).join(" ");

    improvedMessage = breakLoopMessage;
    improvedActions = [nextAction];
    improvedQuestions = nextQuestion ? [nextQuestion.question] : [];
    
    if (nextQuestion) {
      ledger = markSlotAsked(ledger, nextQuestion.slot, now);
    }
  }
  // Normal flow: acknowledge new info, provide value, then ask
  else {
    // Check if the output already seems good
    const hasInsight = improvedMessage.length > 50 && (
      improvedMessage.includes("$") ||
      improvedMessage.includes("budget") ||
      improvedMessage.includes("spend") ||
      improvedMessage.includes("save")
    );

    if (!hasInsight || improvedMessage.length < 100) {
      // Enhance with guaranteed value
      const parts: string[] = [];
      
      if (newFacts.length > 0) {
        parts.push(`Got it — ${newFacts.join(", ")}.`);
      }
      
      if (deltaInsight) {
        parts.push(deltaInsight);
      }
      
      // Include original message if it has substance
      if (improvedMessage.length > 50 && !improvedMessage.includes("Here is what I heard")) {
        parts.push(improvedMessage);
      } else {
        parts.push(nextAction);
      }

      // Add a question only if we have one and it's not too much
      if (nextQuestion && parts.length < 4) {
        parts.push(nextQuestion.question);
        ledger = markSlotAsked(ledger, nextQuestion.slot, now);
        improvedQuestions = [nextQuestion.question];
      }

      improvedMessage = parts.join(" ");
    } else if (nextQuestion && !improvedQuestions.length) {
      // Add a question to an otherwise good response
      improvedMessage = `${improvedMessage} ${nextQuestion.question}`;
      ledger = markSlotAsked(ledger, nextQuestion.slot, now);
      improvedQuestions = [nextQuestion.question];
    }
  }

  // Ensure we always have at least one action
  if (improvedActions.length === 0) {
    improvedActions = [nextAction];
  }

  // Cap and clean
  improvedActions = improvedActions.slice(0, 2);
  improvedQuestions = improvedQuestions.slice(0, 1);

  const guardedOutput: CoachOutput = {
    ...output,
    assistantMessage: improvedMessage,
    actions: improvedActions,
    openQuestions: improvedQuestions,
  };

  return {
    output: guardedOutput,
    slotLedger: ledger,
    establishedFacts,
    frustrationDetectedAt,
  };
}

/**
 * Legacy compatibility wrapper
 */
export function applyCoachResponseGuards(
  output: CoachOutput,
  input: { userMessage: string; contextPacket: CoachContextPacket }
): CoachOutput {
  const result = applyAntiLoopGuards(output, input);
  return result.output;
}
