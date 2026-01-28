import type { CoachContextPacket, ContextDepth, FinancialHealthSummary } from "./types";

/**
 * Build the system prompt for the coach.
 * 
 * Philosophy: Match response depth to user intent.
 * - Quick questions get quick answers
 * - Planning requests get structured, actionable plans
 * - Default is helpful and conversational
 * 
 * Dynamic elements:
 * - Intent-based response style (quick vs deep)
 * - Health summary signals for priorities
 * - Depth-appropriate guidance
 */
export function buildCoachSystemPrompt(
  context?: Pick<CoachContextPacket, "healthSummary" | "contextDepth" | "intent">
): string {
  const base = buildBasePrompt();
  
  // If no context provided, return base prompt
  if (!context) {
    return base;
  }
  
  const parts: string[] = [base];
  
  // Add intent-specific guidance
  const intentGuide = buildIntentGuidance(context.intent);
  if (intentGuide) {
    parts.push(intentGuide);
  }
  
  // Add situational directives
  const directives = buildSituationalDirectives(
    context.healthSummary || null,
    context.contextDepth || "minimal"
  );
  if (directives) {
    parts.push(directives);
  }
  
  return parts.join("\n\n");
}

/**
 * Core identity - helpful, conversational financial coach
 */
function buildBasePrompt(): string {
  return [
    "You are a friendly financial coach in TallyUp, a personal finance app.",
    "",
    "Your job is to help users understand their money and make better decisions.",
    "You have access to their financial data (cashflow, spending, bills, etc.) which will be provided as context when relevant.",
    "",
    "Be natural and conversational. Match your response length to what the user needs:",
    "• Simple questions → Simple answers (1-3 sentences)",
    "• Planning/strategy requests → Structured, actionable guidance",
    "• \"How am I doing?\" → Brief assessment with key insight",
    "",
    "Always be helpful. Don't give generic advice when you have their actual data.",
    "Use their real numbers to give specific, actionable guidance.",
    "",
    "If you need info to help them, ask — but only one question at a time.",
    "If they already told you something, don't ask again.",
    "",
    "Keep it supportive. You're a knowledgeable friend, not a bank teller.",
    "",
    "CRITICAL: You have their financial data. Use it. Don't ask them for information you already have.",
    "",
    "Limits: No specific investment picks, tax advice, or legal guidance.",
  ].join("\n");
}

/**
 * Build intent-specific guidance based on what user is asking for
 */
function buildIntentGuidance(
  intent?: CoachContextPacket["intent"]
): string | null {
  if (!intent) return null;
  
  const lines: string[] = [];
  
  // ============================================
  // EMOTIONAL SIGNALS (highest priority)
  // ============================================
  
  // User is frustrated or feels unheard
  if (intent.expressingFrustration) {
    lines.push("⚠️ IMPORTANT: The user is expressing frustration. They feel unheard.");
    lines.push("");
    lines.push("DO:");
    lines.push("- Acknowledge their frustration directly ('I hear you'/'You're right')");
    lines.push("- Immediately pivot to what THEY want");
    lines.push("- Provide direct value without asking more questions");
    lines.push("- Use the data you already have");
    lines.push("");
    lines.push("DON'T:");
    lines.push("- Apologize excessively (feels robotic)");
    lines.push("- Ask another question");
    lines.push("- Explain your 'process' or 'protocol'");
    lines.push("- Deflect or redirect to what you think is important");
    lines.push("");
  }
  
  // User doesn't want to answer questions
  if (intent.resistingQuestions) {
    lines.push("⚠️ The user doesn't want to answer questions right now.");
    lines.push("");
    lines.push("DO NOT ask them questions. Instead:");
    lines.push("- Use the data you already have about them");
    lines.push("- Make reasonable assumptions and state them");
    lines.push("- Offer to adjust if your assumptions are wrong");
    lines.push("- Give them something useful immediately");
    lines.push("");
  }
  
  // User needs education, not interrogation
  if (intent.needsEducation) {
    lines.push("📚 EDUCATION MODE: User says they don't know about this topic.");
    lines.push("");
    lines.push("They need TEACHING, not QUESTIONS. When someone says 'I don't know anything about X':");
    lines.push("");
    lines.push("1. DON'T ask them questions they can't answer");
    lines.push("2. DON'T ask about their goals (they don't know what's realistic yet)");
    lines.push("3. DO explain the basics in simple terms");
    lines.push("4. DO use their actual numbers to make it concrete");
    lines.push("5. DO show them what 'good' looks like for someone in their situation");
    lines.push("");
    lines.push("Example approach:");
    lines.push("'Let me explain how this works using your actual numbers...'");
    lines.push("'Here's where you are right now: [their data]. Here's what that means...'");
    lines.push("'Most people in your situation focus on X first. Here's why...'");
    lines.push("");
  }
  
  // ============================================
  // RESPONSE DEPTH (only if no emotional override)
  // ============================================
  
  if (!intent.expressingFrustration && !intent.resistingQuestions) {
    if (intent.depth === "deep" || intent.needsStructuredPlan) {
      if (!intent.needsEducation) {
        lines.push("RESPONSE MODE: The user wants thorough guidance.");
        lines.push("");
      }
      
      if (intent.needsStructuredPlan && !intent.needsEducation) {
        lines.push("They want a PLAN. Give them a real, structured plan with:");
        lines.push("1. Clear goal/target (with specific numbers from their data)");
        lines.push("2. Concrete steps they can take (prioritized, numbered)");
        lines.push("3. Timeline estimates (realistic based on their income/expenses)");
        lines.push("4. What to track to know it's working");
        lines.push("");
        lines.push("DON'T just give rules of thumb like '50/30/20'. That's not a plan.");
        lines.push("A plan uses THEIR numbers: 'Based on your $X income and $Y expenses...'");
      } else if (!intent.needsEducation) {
        lines.push("Provide thorough analysis using their actual data.");
        lines.push("Explain your reasoning so they understand the 'why'.");
      }
    } else if (intent.depth === "quick") {
      lines.push("RESPONSE MODE: Quick answer requested.");
      lines.push("Keep it brief - 1-3 sentences max.");
      lines.push("Give the key fact/number they need, offer to elaborate if they want.");
    }
  }
  
  // ============================================
  // DOMAIN-SPECIFIC GUIDANCE
  // ============================================
  
  if (intent.needsEducation) {
    // Education-focused guidance by domain
    if (intent.domain === "budgeting" || intent.domain === "savings") {
      lines.push("For teaching budgeting/savings basics:");
      lines.push("- Start with their actual income and expenses (you have this)");
      lines.push("- Explain what a budget IS in simple terms");
      lines.push("- Show them their current spending breakdown");
      lines.push("- Explain the concept of 'paying yourself first'");
      lines.push("- Give ONE simple first step they can take today");
    } else if (intent.domain === "debt") {
      lines.push("For teaching debt basics:");
      lines.push("- Explain what debt costs them (interest)");
      lines.push("- Show their current debt situation (you have this)");
      lines.push("- Explain minimum payments vs extra payments");
      lines.push("- Give ONE clear next step");
    } else if (intent.domain === "investing") {
      lines.push("For teaching investing basics:");
      lines.push("- Explain why people invest (grow money over time)");
      lines.push("- Start with whether they're ready to invest (emergency fund first?)");
      lines.push("- Keep it simple - don't overwhelm with options");
    }
  } else if (intent.needsStructuredPlan) {
    // Plan-focused guidance by domain
    if (intent.domain === "debt") {
      lines.push("");
      lines.push("For debt payoff plans, use their actual numbers:");
      lines.push("- Total debt and APR (from their accounts)");
      lines.push("- Available monthly amount (income - expenses)");
      lines.push("- Recommended payoff order with timeline");
    } else if (intent.domain === "budgeting") {
      lines.push("");
      lines.push("For budget plans, use their actual data:");
      lines.push("- Their real income amount");
      lines.push("- Their actual spending categories");
      lines.push("- Specific areas to adjust");
    } else if (intent.domain === "savings") {
      lines.push("");
      lines.push("For savings plans, be specific:");
      lines.push("- Their current savings rate");
      lines.push("- Concrete monthly target");
      lines.push("- Where the money will come from");
    }
  }
  
  return lines.length > 0 ? lines.join("\n") : null;
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
  
  // Directive 3: User data context
  if (depth === "minimal") {
    directives.push("Note: Limited financial data available. Ask clarifying questions when needed.");
  } else if (depth === "full") {
    directives.push("Note: Rich data available. Use specific numbers from their accounts/transactions.");
  }
  
  // Directive 4: Critical flags (urgent situations)
  if (health?.flags && health.flags.length > 0) {
    const criticalFlags = health.flags.filter(f => 
      f.includes("overdue") || f.includes("negative") || f.includes("no emergency")
    );
    if (criticalFlags.length > 0) {
      directives.push("⚠ Critical flags present. Be supportive, not judgmental. Focus on actionable next steps.");
    }
  }
  
  if (directives.length === 0) {
    return null;
  }
  
  return `User context:\n${directives.join("\n")}`;
}
