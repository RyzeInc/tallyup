/**
 * Build a compact, token-efficient context string from the full context packet.
 * 
 * Design principles:
 * - Stable key=value format (no emoji, no markdown, no prose)
 * - Hard caps on all user-written strings (80 chars)
 * - Intent-gated sections to minimize tokens
 * - Extended financial context (A-G) for complete coach perspective
 * - Adaptive depth: minimal/standard/full based on user data completeness
 * - Health summary first: pre-computed signals before raw metrics
 * 
 * Token budget targets (by depth):
 * - Minimal: ~100-150 tokens (new users, simple queries)
 * - Standard: ~200-350 tokens (active users, most queries)
 * - Full: ~400-600 tokens (complex analysis, power users)
 */

import type { CoachContextPacket, ContextDepth } from "./types";

const MAX_STRING_LEN = 80;

// Depth determines how much detail to include
type DepthConfig = {
  maxAccounts: number;
  maxGoals: number;
  maxDebts: number;
  maxCategories: number;
  includeSecondaryMetrics: boolean;
  includeRawBalances: boolean;
}

const DEPTH_CONFIG: Record<ContextDepth, DepthConfig> = {
  minimal: {
    maxAccounts: 1,
    maxGoals: 1,
    maxDebts: 1,
    maxCategories: 3,
    includeSecondaryMetrics: false,
    includeRawBalances: false,
  },
  standard: {
    maxAccounts: 2,
    maxGoals: 2,
    maxDebts: 2,
    maxCategories: 4,
    includeSecondaryMetrics: true,
    includeRawBalances: true,
  },
  full: {
    maxAccounts: 3,
    maxGoals: 3,
    maxDebts: 3,
    maxCategories: 5,
    includeSecondaryMetrics: true,
    includeRawBalances: true,
  },
};

function truncate(s: string | undefined | null, max = MAX_STRING_LEN): string {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 3) + "..." : clean;
}

function cents(c: number | undefined | null): string {
  if (c === undefined || c === null) return "0";
  return Math.round(c / 100).toString();
}

// ============================================
// HEALTH SUMMARY (always first - pre-computed signals)
// ============================================

function buildHealthContext(packet: CoachContextPacket): string[] {
  const lines: string[] = [];
  const hs = packet.healthSummary;
  if (!hs) return lines;

  // Primary signal: score + top concern + opportunity (high-value, low-token)
  const parts = [`score=${hs.overallScore}/100`];
  if (hs.topConcern) parts.push(`concern=${hs.topConcern}`);
  if (hs.topOpportunity) parts.push(`opportunity=${hs.topOpportunity}`);
  
  lines.push(`HEALTH ${parts.join(" ")}`);

  // Flags (critical issues only)
  if (hs.flags && hs.flags.length > 0) {
    lines.push(`FLAGS: ${hs.flags.slice(0, 5).join(", ")}`);
  }

  return lines;
}

// ============================================
// CORE CONTEXT (always included)
// ============================================

function buildCoreContext(packet: CoachContextPacket): string[] {
  const lines: string[] = [];

  // Cashflow (always useful)
  const cf = packet.cashflow;
  if (cf) {
    const net = cf.netCents >= 0 ? `+${cents(cf.netCents)}` : cents(cf.netCents);
    lines.push(`CF month=${packet.month?.label || "current"} inc=${cents(cf.incomeCents)} exp=${cents(cf.expenseCents)} net=${net}`);
  }

  // Anti-loop signals (critical for behavior)
  const facts = packet.establishedFacts;
  if (facts && facts.length > 0) {
    const truncatedFacts = facts.slice(0, 5).map(f => truncate(f, 60)).join("; ");
    lines.push(`CONFIRMED: ${truncatedFacts}`);
  }

  // Slot cooldowns
  const ledger = packet.slotLedger;
  if (ledger && typeof ledger === "object") {
    const slots = ledger as Record<string, { asked?: number; answered?: number }>;
    const dontAsk: string[] = [];
    const now = Date.now();
    const COOLDOWN_MS = 5 * 60 * 1000;
    
    for (const [slot, state] of Object.entries(slots)) {
      if (state?.asked && (now - state.asked) < COOLDOWN_MS && !state?.answered) {
        dontAsk.push(slot.replace(/_/g, " "));
      }
    }
    
    if (dontAsk.length > 0) {
      lines.push(`DONTASK: ${dontAsk.join(", ")}`);
    }
  }

  // Frustration guard
  if (packet.frustrationDetectedAt) {
    const elapsed = Date.now() - packet.frustrationDetectedAt;
    const cooldownMs = 10 * 60 * 1000;
    if (elapsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsed) / 60000);
      lines.push(`FRUSTRATED: true remaining_min=${remaining}`);
    }
  }

  return lines;
}

// ============================================
// A) BALANCE SHEET / NET WORTH (hierarchical by depth)
// ============================================

function buildBalanceSheetContext(packet: CoachContextPacket, depth: DepthConfig): string[] {
  const lines: string[] = [];
  const bs = packet.balanceSheet;
  if (!bs) return lines;

  // Net worth summary (always included - top-level)
  const netSign = bs.netWorthCents >= 0 ? "+" : "";
  lines.push(`NW net=${netSign}${cents(bs.netWorthCents)} assets=${cents(bs.totalAssetsCents)} liab=${cents(bs.totalLiabilitiesCents)}`);

  // Skip raw balances for minimal depth (health summary has the signals)
  if (!depth.includeRawBalances) return lines;

  // Liquid cash (checking + savings totals)
  const checkingTotal = bs.checking.reduce((sum, a) => sum + a.balanceCents, 0);
  const savingsTotal = bs.savings.reduce((sum, a) => sum + a.balanceCents, 0);
  if (checkingTotal > 0 || savingsTotal > 0) {
    lines.push(`CASH checking=${cents(checkingTotal)} savings=${cents(savingsTotal)}`);
  }

  // Top credit cards with utilization (limited by depth)
  if (bs.creditCards.length > 0) {
    const ccStr = bs.creditCards.slice(0, depth.maxAccounts).map(cc => {
      const util = cc.utilizationPct && depth.includeSecondaryMetrics ? `(${cc.utilizationPct}%util)` : "";
      const apr = cc.apr ? `@${cc.apr}%` : "";
      return `${truncate(cc.name, 15)}=${cents(cc.balanceCents)}${apr}${util}`;
    }).join(" ");
    lines.push(`CC: ${ccStr}`);
  }

  // Top loans (limited by depth)
  if (bs.loans.length > 0) {
    const loanStr = bs.loans.slice(0, depth.maxAccounts).map(l => {
      const apr = l.apr ? `@${l.apr}%` : "";
      return `${truncate(l.name, 15)}=${cents(l.balanceCents)}${apr}`;
    }).join(" ");
    lines.push(`LOANS: ${loanStr}`);
  }

  return lines;
}

// ============================================
// B) INCOME PROFILE + BASELINE OBLIGATIONS
// ============================================

function buildIncomeContext(packet: CoachContextPacket): string[] {
  const lines: string[] = [];
  const ip = packet.incomeProfile;
  
  if (ip && ip.last90dTotalCents > 0) {
    const parts = [
      `avg90=${cents(ip.last90dAvgMonthlyCents)}`,
      `vol=${ip.volatilityScore}`,
    ];
    if (ip.cadence) parts.push(`cadence=${ip.cadence}`);
    if (ip.incomeSourceCount > 1) parts.push(`sources=${ip.incomeSourceCount}`);
    if (ip.primarySourcePct < 80) parts.push(`concentration=${ip.primarySourcePct}%`);
    
    lines.push(`INC ${parts.join(" ")}`);
  }

  const bo = packet.baselineObligations;
  if (bo && bo.totalMonthlyCents > 0) {
    const parts = [`total=${cents(bo.totalMonthlyCents)}`];
    if (bo.housing > 0) parts.push(`housing=${cents(bo.housing)}`);
    if (bo.debtMinimums > 0) parts.push(`debtMin=${cents(bo.debtMinimums)}`);
    
    lines.push(`BASELINE ${parts.join(" ")}`);
  }

  return lines;
}

// ============================================
// C) DEBT STRUCTURE (hierarchical by depth)
// ============================================

function buildDebtContext(packet: CoachContextPacket, depth: DepthConfig): string[] {
  const lines: string[] = [];
  const ds = packet.debtSnapshot;
  if (!ds || ds.totalDebtCents === 0) return lines;

  // Summary line (always included - top-level)
  const parts = [
    `total=${cents(ds.totalDebtCents)}`,
    `minPay=${cents(ds.totalMinPaymentsCents)}`,
  ];
  if (ds.weightedAvgApr > 0) {
    parts.push(`avgAPR=${ds.weightedAvgApr.toFixed(1)}%`);
  }
  lines.push(`DEBT ${parts.join(" ")}`);

  // Overdue debts (urgent - always included if present)
  const overdue = ds.debts.filter(d => d.isOverdue);
  if (overdue.length > 0) {
    const overdueStr = overdue.slice(0, 2).map(d => truncate(d.name, 15)).join(", ");
    lines.push(`DEBT_OVERDUE: ${overdueStr}`);
  }

  // Skip detailed breakdown for minimal depth
  if (!depth.includeSecondaryMetrics) return lines;

  // Highest APR debt (priority target)
  if (ds.highestAprDebt) {
    lines.push(`DEBT_PRIORITY: ${truncate(ds.highestAprDebt.name, 20)} bal=${cents(ds.highestAprDebt.balanceCents)} apr=${ds.highestAprDebt.apr}%`);
  }

  return lines;
}

// ============================================
// D) GOALS (hierarchical by depth)
// ============================================

function buildGoalsContext(packet: CoachContextPacket, depth: DepthConfig): string[] {
  const lines: string[] = [];
  const gs = packet.goalSnapshot;
  if (!gs || gs.goals.length === 0) return lines;

  // Top goals with progress (limited by depth)
  const goalStr = gs.goals.slice(0, depth.maxGoals).map((g, i) => {
    const progress = `${g.progressPct}%`;
    const monthly = g.monthlyNeeded && depth.includeSecondaryMetrics ? ` need=${cents(g.monthlyNeeded)}/mo` : "";
    return `${i + 1})${truncate(g.name, 15)}=${progress}${monthly}`;
  }).join(" ");
  
  lines.push(`GOALS: ${goalStr}`);

  return lines;
}

// ============================================
// E) RISK PROFILE
// ============================================

function buildRiskContext(packet: CoachContextPacket): string[] {
  const lines: string[] = [];
  const rp = packet.riskProfile;
  if (!rp) return lines;

  const parts: string[] = [];
  
  // Emergency fund months (critical metric)
  if (rp.emergencyFundMonths !== null) {
    parts.push(`efMonths=${rp.emergencyFundMonths}`);
  }
  
  if (rp.dependents > 0) parts.push(`deps=${rp.dependents}`);
  if (rp.housingType) parts.push(`housing=${rp.housingType}`);
  if (rp.employmentType) parts.push(`employment=${rp.employmentType}`);

  // Insurance flags (only show gaps)
  const insuranceGaps: string[] = [];
  if (rp.hasHealthInsurance === false) insuranceGaps.push("health");
  if (rp.hasRentersHomeInsurance === false) insuranceGaps.push("home");
  if (rp.dependents > 0 && rp.hasLifeInsurance === false) insuranceGaps.push("life");
  
  if (insuranceGaps.length > 0) {
    parts.push(`noInsurance=${insuranceGaps.join(",")}`);
  }

  if (parts.length > 0) {
    lines.push(`RISK ${parts.join(" ")}`);
  }

  return lines;
}

// ============================================
// F) TAX PROFILE
// ============================================

function buildTaxContext(packet: CoachContextPacket): string[] {
  const lines: string[] = [];
  const tp = packet.taxProfile;
  if (!tp) return lines;

  const parts: string[] = [];
  
  if (tp.filingStatus) parts.push(`status=${tp.filingStatus}`);
  if (tp.incomeTypes.length > 0) parts.push(`types=${tp.incomeTypes.join(",")}`);
  if (tp.estimatedBracket) parts.push(`bracket=${tp.estimatedBracket}`);
  if (tp.usuallyOwes !== null) parts.push(`owes=${tp.usuallyOwes ? "yes" : "no"}`);
  if (tp.hasRetirementAccounts) parts.push(`retirement=yes`);

  if (parts.length > 0) {
    lines.push(`TAX ${parts.join(" ")}`);
  }

  return lines;
}

// ============================================
// G) TRANSACTION DIAGNOSTICS (troubleshooting only)
// ============================================

function buildDiagnosticsContext(packet: CoachContextPacket): string[] {
  const lines: string[] = [];
  const td = packet.transactionDiagnostics;
  if (!td) return lines;

  // Flags for potential issues
  const flags: string[] = [];
  if (td.cashWithdrawals90dCents > 50000) { // >$500 in 90 days
    flags.push(`cash=${cents(td.cashWithdrawals90dCents)}`);
  }
  if (td.refunds90dCents > 20000) { // >$200 in refunds
    flags.push(`refunds=${cents(td.refunds90dCents)}`);
  }
  if (td.suspectedDuplicates.length > 0) {
    flags.push(`dupes=${td.suspectedDuplicates.length}`);
  }

  if (flags.length > 0) {
    lines.push(`TX_FLAGS: ${flags.join(" ")}`);
  }

  // Subscriptions (top 3 by cost)
  if (td.subscriptions.length > 0) {
    const subStr = td.subscriptions.slice(0, 3).map(s => 
      `${truncate(s.name, 12)}=${cents(s.monthlyCents)}/mo`
    ).join(" ");
    lines.push(`SUBS: ${subStr}`);
  }

  return lines;
}

// ============================================
// SPENDING CONTEXT (budgeting intents - hierarchical by depth)
// ============================================

function buildSpendContext(packet: CoachContextPacket, depth: DepthConfig): string[] {
  const lines: string[] = [];

  // Top categories (limited by depth)
  const cats = packet.spendByCategory?.slice(0, depth.maxCategories);
  if (cats && cats.length > 0) {
    const catStr = cats.map(c => `${truncate(c.category, 12)}=${cents(c.amountCents)}`).join(" ");
    lines.push(`TOPSPEND: ${catStr}`);
  }

  // Skip secondary metrics for minimal depth
  if (!depth.includeSecondaryMetrics) return lines;

  // Anomalies
  const anomalies = packet.anomalies?.slice(0, 3);
  if (anomalies && anomalies.length > 0) {
    const anomStr = anomalies.map(a => {
      const delta = a.deltaCents >= 0 ? `+${cents(a.deltaCents)}` : cents(a.deltaCents);
      return `${truncate(a.category, 12)}=${delta}`;
    }).join(" ");
    lines.push(`ANOM: ${anomStr}`);
  }

  // Upcoming bills
  const bills = packet.upcomingBills?.slice(0, 5);
  if (bills && bills.length > 0) {
    const billStr = bills.map(b => {
      const amt = b.expectedAmountCents ? `(${cents(b.expectedAmountCents)})` : "";
      return `${truncate(b.name, 12)}${amt}`;
    }).join(" ");
    lines.push(`BILLS: ${billStr}`);
  }

  return lines;
}

// ============================================
// PROFILE CONTEXT (foundation data)
// ============================================

function buildProfileContext(packet: CoachContextPacket): string[] {
  const lines: string[] = [];

  const foundation = packet.foundationSnapshot as Record<string, unknown> | null;
  if (foundation && Object.keys(foundation).length > 0) {
    const parts: string[] = [];
    
    if (foundation.primaryGoal) {
      parts.push(`goal=${truncate(foundation.primaryGoal as string, 40)}`);
    }
    if (foundation.riskTolerance) {
      parts.push(`riskTol=${foundation.riskTolerance}`);
    }
    
    if (parts.length > 0) {
      lines.push(`PROFILE: ${parts.join(" ")}`);
    }
  }

  // Draft updates (pending confirmation)
  const draft = packet.draftFoundation as Record<string, unknown> | null;
  if (draft && Object.keys(draft).length > 0) {
    const dParts: string[] = [];
    for (const [key, value] of Object.entries(draft)) {
      if (value !== undefined && value !== null) {
        dParts.push(`${key}=${truncate(String(value), 30)}`);
      }
    }
    if (dParts.length > 0 && dParts.length <= 5) {
      lines.push(`DRAFT: ${dParts.join(" ")}`);
    }
  }

  return lines;
}

// ============================================
// MEMORY CONTEXT
// ============================================

function buildMemoryContext(packet: CoachContextPacket): string[] {
  const lines: string[] = [];

  // Memory snippets (if provided)
  const memories = packet.memorySnippets;
  if (memories && memories.length > 0) {
    const topMemories = memories
      .filter(m => m.score > 0.3)
      .slice(0, 3)
      .map(m => truncate(m.content, 60));
    
    if (topMemories.length > 0) {
      lines.push(`MEMORY: ${topMemories.join("; ")}`);
    }
  }

  // Knowledge snippets (if provided)
  const knowledge = packet.knowledgeSnippets;
  if (knowledge && knowledge.length > 0) {
    const topKnowledge = knowledge
      .filter(k => k.score > 0.3)
      .slice(0, 2)
      .map(k => truncate(k.content, 80));
    
    if (topKnowledge.length > 0) {
      lines.push(`KNOWLEDGE: ${topKnowledge.join("; ")}`);
    }
  }

  // Session summary
  if (packet.sessionSummary) {
    lines.push(`SESSION: ${truncate(packet.sessionSummary, 100)}`);
  }

  return lines;
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Main entry point - builds context based on intent and depth
 * 
 * Adaptive depth:
 * - minimal: New users, simple queries, app help
 * - standard: Active users, most domain queries
 * - full: Power users, complex analysis, troubleshooting
 * 
 * Intent gating (within depth):
 * - "debt": Full debt context + balance sheet + baseline
 * - "budgeting": Spending + balance sheet + income
 * - "savings": Goals + balance sheet + baseline + income
 * - "investing": Balance sheet (investments) + risk + tax
 * - "tax": Tax profile + income
 * - "app_help": Minimal (just core + health)
 * - default: Core + health + spending + balance sheet summary
 */
export function buildCompactContext(
  packet: CoachContextPacket,
  options?: { intent?: { domain?: string | null; task?: string | null } | null }
): string {
  const lines: string[] = [];
  const intent = options?.intent || packet.intent;
  const domain = intent?.domain;
  
  // Determine depth from packet (computed by server) or default to minimal
  const contextDepth = packet.contextDepth || "minimal";
  const depth = DEPTH_CONFIG[contextDepth];

  // HEALTH SUMMARY FIRST - pre-computed signals save tokens vs raw metrics
  // This is the most efficient way to give the LLM actionable context
  lines.push(...buildHealthContext(packet));

  // Always include core context (anti-loop, frustration, cashflow)
  lines.push(...buildCoreContext(packet));

  // Gate extended context by domain (functions now respect depth)
  switch (domain) {
    case "debt":
      // Full debt analysis context
      lines.push(...buildDebtContext(packet, depth));
      lines.push(...buildBalanceSheetContext(packet, depth));
      lines.push(...buildIncomeContext(packet)); // for debt-to-income
      break;

    case "budgeting":
      // Spending analysis
      lines.push(...buildSpendContext(packet, depth));
      lines.push(...buildBalanceSheetContext(packet, depth));
      lines.push(...buildIncomeContext(packet));
      break;

    case "savings":
      // Goals and capacity
      lines.push(...buildGoalsContext(packet, depth));
      lines.push(...buildBalanceSheetContext(packet, depth));
      lines.push(...buildIncomeContext(packet));
      break;

    case "investing":
      // Investments, risk, tax implications
      lines.push(...buildBalanceSheetContext(packet, depth));
      lines.push(...buildRiskContext(packet));
      lines.push(...buildTaxContext(packet));
      break;

    case "tax":
      // Tax context
      lines.push(...buildTaxContext(packet));
      lines.push(...buildIncomeContext(packet));
      break;

    case "app_help":
      // Minimal - just core context + health (already added)
      break;

    default:
      // General query - balanced context with depth-awareness
      lines.push(...buildBalanceSheetContext(packet, depth));
      lines.push(...buildSpendContext(packet, depth));
      lines.push(...buildGoalsContext(packet, depth));
      break;
  }

  // Always include profile (small overhead, high value)
  lines.push(...buildProfileContext(packet));
  
  // Memory context only for standard+ depth (saves tokens for minimal)
  if (contextDepth !== "minimal") {
    lines.push(...buildMemoryContext(packet));
  }

  // Include diagnostics only when task is troubleshooting AND full depth
  if (intent?.task === "troubleshoot" && packet.transactionDiagnostics && contextDepth === "full") {
    lines.push(...buildDiagnosticsContext(packet));
  }

  if (lines.length === 0) {
    return "NO_DATA";
  }

  return lines.join("\n");
}

/**
 * Build conversation messages with smart compression
 * 
 * Strategy:
 * - Keep last 2 turns verbatim (most recent context)
 * - Summarize earlier turns into a single compressed message
 * - Preserve user intent signals in compression
 */
export function buildConversationMessages(
  packet: CoachContextPacket,
  maxMessages: number = 4
): Array<{ role: "user" | "assistant"; content: string }> {
  const all = packet.recentConversation || [];
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  
  // If we have more than 4 messages, compress older ones
  if (all.length > 4) {
    // Take the older messages (everything except last 4)
    const older = all.slice(0, -4);
    
    // Compress into a summary (extract key user statements)
    const userStatements = older
      .filter(m => m.role === "user")
      .map(m => truncate(m.content, 40))
      .slice(-3); // Keep last 3 user statements from old messages
    
    if (userStatements.length > 0) {
      // Add as a system-style context note (role: assistant with meta marker)
      messages.push({
        role: "assistant" as const,
        content: `[Earlier context: User discussed: ${userStatements.join("; ")}]`
      });
    }
    
    // Add the last 4 messages verbatim
    const recent = all.slice(-4);
    for (const entry of recent) {
      messages.push({
        role: entry.role as "user" | "assistant",
        content: entry.content,
      });
    }
  } else {
    // Small conversation - keep all messages up to maxMessages
    const recent = all.slice(-maxMessages);
    for (const entry of recent) {
      messages.push({
        role: entry.role as "user" | "assistant",
        content: entry.content,
      });
    }
  }
  
  return messages;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
