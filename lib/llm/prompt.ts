import type { CoachContextPacket, ContextDepth, FinancialHealthSummary } from "./types";

/**
 * Build the system prompt for the coach.
 * 
 * Philosophy: The model already knows how to have a conversation.
 * We just need to tell it who it is and adapt to the user's state.
 * 
 * Dynamic elements:
 * - Opening focus based on health summary signals
 * - Depth-appropriate guidance (more detailed for power users)
 * - Situational directives based on flags
 */
export function buildCoachSystemPrompt(
  context?: Pick<CoachContextPacket, "healthSummary" | "contextDepth">
): string {
  const base = buildBasePrompt();
  
  // If no context provided, return base prompt (saves tokens)
  if (!context?.healthSummary && !context?.contextDepth) {
    return base;
  }
  
  const directives = buildSituationalDirectives(
    context.healthSummary || null,
    context.contextDepth || "minimal"
  );
  
  if (!directives) {
    return base;
  }
  
  // Append directives to base (keeps it concise)
  return `${base}\n\n${directives}`;
}

/**
 * Core identity (always included, ~12 lines)
 */
function buildBasePrompt(): string {
  return [
    "You are a friendly financial coach in TallyUp, a personal finance app.",
    "",
    "Your job is to help users understand their money and make better decisions.",
    "You have access to their financial data (cashflow, spending, bills, etc.) which will be provided as context when relevant.",
    "",
    "Be natural. If someone says hi, say hi back. If they ask a question, answer it.",
    "Don't dump data unprompted. Don't interrogate. Just be helpful.",
    "",
    "If you need info to help them, ask — but only one question at a time.",
    "If they already told you something, don't ask again.",
    "",
    "Keep it casual and supportive. You're a helpful friend who's good with money, not a bank or a form.",
    "",
    "Limits: No specific investment picks, tax advice, or legal guidance.",
  ].join("\n");
}

/**
 * Build situational directives based on user state
 * Returns null if no special directives needed (saves tokens)
 */
function buildSituationalDirectives(
  health: FinancialHealthSummary | null,
  depth: ContextDepth
): string | null {
  const directives: string[] = [];
  
  // Directive 1: Opening focus based on top concern
  if (health?.topConcern) {
    const focusMap: Record<string, string> = {
      "overdueDebt": "Priority: User has overdue debt. Acknowledge stress, offer actionable steps.",
      "highDebtAPR": "Priority: High-APR debt detected. Guide toward payoff strategies when relevant.",
      "noEmergencyFund": "Priority: No emergency buffer. Encourage even small savings when appropriate.",
      "negativeNetWorth": "Priority: Negative net worth. Focus on debt reduction and building momentum.",
      "lowLiquidity": "Priority: Low cash reserves. Be sensitive about spending discussions.",
      "highCreditUtilization": "Priority: High credit utilization. Suggest paydown if they ask about scores.",
      "incomeVolatility": "Priority: Irregular income. Frame advice around income variability.",
      "insuranceGap": "Priority: Insurance gaps noted. Mention if risk topics come up naturally.",
    };
    
    const focus = focusMap[health.topConcern];
    if (focus) {
      directives.push(focus);
    }
  }
  
  // Directive 2: Opportunity nudge (only for standard+ users)
  if (health?.topOpportunity && depth !== "minimal") {
    const opportunityMap: Record<string, string> = {
      "buildEmergency": "Opportunity: Room to build emergency fund. Encourage if savings come up.",
      "payHighAPR": "Opportunity: Can accelerate high-APR payoff. Mention avalanche method if asked.",
      "investSurplus": "Opportunity: Positive cashflow available. Discuss investing if they show interest.",
      "optimizeSpending": "Opportunity: Spending optimization possible. Share insights if budgeting discussed.",
    };
    
    const opp = opportunityMap[health.topOpportunity];
    if (opp) {
      directives.push(opp);
    }
  }
  
  // Directive 3: Depth-based guidance
  if (depth === "minimal") {
    directives.push("User is new or has limited data. Keep responses simple, avoid overwhelming detail.");
  } else if (depth === "full") {
    directives.push("Power user with rich data. Feel free to provide detailed analysis when helpful.");
  }
  
  // Directive 4: Critical flags (urgent situations)
  if (health?.flags && health.flags.length > 0) {
    const criticalFlags = health.flags.filter(f => 
      f.includes("overdue") || f.includes("negative") || f.includes("no emergency")
    );
    if (criticalFlags.length > 0) {
      directives.push("⚠ Critical flags present. Be supportive, not judgmental. Focus on next small step.");
    }
  }
  
  if (directives.length === 0) {
    return null;
  }
  
  return `Today's focus:\n${directives.join("\n")}`;
}
