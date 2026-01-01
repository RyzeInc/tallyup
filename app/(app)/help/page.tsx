"use client";

import { useState, type ComponentType, type CSSProperties } from "react";
import * as Lucide from "lucide-react";

interface CheckQuestion {
  question: string;
  answers: string[];
  correctIndex: number;
}

interface LearnNode {
  id: string;
  title: string;
  layers: {
    quick: string[];
    practical: string[];
    deep: string[];
    doItNow: string[];
    check: CheckQuestion[];
  };
}

interface LearnModule {
  id: string;
  title: string;
  nodes: LearnNode[];
}

type LayerId = "quick" | "practical" | "deep" | "doItNow" | "check";

const MODULE_STYLES: Record<
  LearnModule["id"],
  { icon: ComponentType<{ className?: string; style?: CSSProperties }>; color: string }
> = {
  "start-here": { icon: Lucide.Compass, color: "var(--primary)" },
  "read-your-money": { icon: Lucide.BookOpen, color: "var(--success)" },
  "recurring-costs": { icon: Lucide.RefreshCw, color: "var(--warning)" },
  "building-habits": { icon: Lucide.Sparkles, color: "var(--chart-5)" },
  safety: { icon: Lucide.ShieldCheck, color: "var(--danger)" },
  grow: { icon: Lucide.Leaf, color: "var(--chart-2)" },
};

const LAYER_ORDER: LayerId[] = ["quick", "practical", "deep", "doItNow", "check"];

const LAYER_STYLES: Record<
  LayerId,
  { title: string; icon: ComponentType<{ className?: string; style?: CSSProperties }>; color: string; border: string }
> = {
  quick: { title: "Quick", icon: Lucide.Zap, color: "var(--primary)", border: "var(--primary)" },
  practical: { title: "Practical", icon: Lucide.Hammer, color: "var(--success)", border: "var(--success)" },
  deep: { title: "Deep", icon: Lucide.Mountain, color: "var(--warning)", border: "var(--warning)" },
  doItNow: { title: "Do it Now", icon: Lucide.Flag, color: "var(--chart-2)", border: "var(--chart-2)" },
  check: { title: "Check", icon: Lucide.CheckCircle2, color: "var(--chart-5)", border: "var(--chart-5)" },
};

const MODULES: LearnModule[] = [
  {
    id: "start-here",
    title: "Start Here",
    nodes: [
      {
        id: "money-mindset-goals",
        title: "Money Mindset and Goals",
        layers: {
          quick: [
            "Getting a handle on your money starts in your mind. It is not about shaming past mistakes or depriving yourself. It is about seeing your real financial picture clearly and setting goals for where you want to go.",
            "Begin by taking stock of your income, expenses, debts, and savings with no guilt or panic.",
            "Key rule: Change your mindset from deprivation to aspiration. View budgeting and saving as tools to build the life you want, not as punishments.",
          ],
          practical: [
            "Define your goals. Write down one or two specific money goals. Make them realistic and meaningful to you.",
            "Assess where you are. List assets and liabilities to get your starting net worth snapshot. Track your monthly income and last month of spending to see where money goes now.",
            "No blame, just facts. If you feel anxiety when you review your finances, take a breath and remind yourself these are just numbers, not a judgment of your worth.",
            "Set priority goals. Identify which goal matters most right now and put a target date and amount on it.",
            "Visualize success. Attach positive meaning to your goals to keep motivation strong.",
            "Common mistakes: Trying to tackle everything at once, comparing yourself to others, or setting goals so high they feel impossible. Small wins build momentum.",
            "Example: Jay sets a goal to build a $500 emergency fund in three months. He tracks expenses and notices $100 a month on eating out. He redirects $75 a month to savings and sells an old bike to jump-start the fund. By focusing on a goal that excites him, he stays motivated.",
          ],
          deep: [
            "A healthy money mindset supports every other financial habit. Financial mindfulness means engaging with your money even when it is uncomfortable, so you catch issues early and avoid knee-jerk decisions.",
            "Goal setting works best when it is personal and actionable. Use a SMART structure if you like, but more importantly tie goals to what you care about. Naming a goal can shift the mindset from restriction to aspiration.",
            "Balance short-term enjoyment and long-term goals. Build in guilt-free treats so you do not burn out. Decide in advance what you can afford for fun, then enjoy it.",
            "Track progress and revisit goals monthly. If you reached a goal, celebrate and set a new one. If you fell short, adjust the timeline or amount and keep going. This is a long game.",
          ],
          doItNow: [
            "Open the Goals feature and create one personal financial goal. Enter a target amount and deadline. If possible, add a tag or nickname that makes it feel personal. This makes your aspiration concrete and gives you something positive to work toward immediately.",
          ],
          check: [
            {
              question: "You check your bank balance and feel a wave of anxiety. What is the best response?",
              answers: [
                "Close the app; it is too depressing.",
                "Acknowledge the anxiety, but review the numbers anyway to understand where you stand.",
                "Scold yourself for past spending and vow to never spend on anything fun again.",
              ],
              correctIndex: 1,
            },
            {
              question: "Which of these is a SMART financial goal?",
              answers: [
                "I want to save a lot of money someday.",
                "Save $300 for a new laptop in 6 months by cutting dining out to once a week.",
                "Become rich by avoiding all unnecessary spending forever.",
              ],
              correctIndex: 1,
            },
            {
              question: "You stuck to your budget all month and have $50 left over. What is a healthy, mindful way to handle it?",
              answers: [
                "Splurge it all on an impulse purchase.",
                "Add it to your savings goal and treat yourself to an affordable reward.",
                "Set a more restrictive budget next month since you can live on less.",
              ],
              correctIndex: 1,
            },
          ],
        },
      },
      {
        id: "track-your-money",
        title: "Track Your Money (Every Dollar, Every Dime)",
        layers: {
          quick: [
            "You cannot improve what you do not measure. The first habit of financial success is tracking your money so you know how much comes in and where it goes.",
            "Most people are surprised the first time they do this, but awareness is powerful. It shines a light on leaks and blind spots so you can fix them.",
            "Key rule: What gets measured gets managed. If you log every expense, you take control instead of wondering where money went.",
          ],
          practical: [
            "Choose a tracking method and be consistent. Use an app, a spreadsheet, or a notebook.",
            "Log all income and expenses for 30 days. Track every dollar, even small purchases.",
            "Categorize your spending and mark needs vs wants. The goal is to see patterns, not perfection.",
            "Total it up weekly so you can course-correct before month end.",
            "Review the month. Compare income and spending and note any surprises.",
            "Common mistakes: Ignoring small purchases, giving up after an overspend week, or procrastinating logging. Partial data is better than none.",
            "Example: Sofia tracked for a month and saw $250 on subscriptions she barely used. She canceled a few and saved over $100 a month. She also noticed she spent less on groceries than expected, which explained her higher dining out.",
          ],
          deep: [
            "Tracking is like diagnostics for financial health. Your cash flow statement is money in vs money out each month. Your balance sheet is assets minus liabilities.",
            "Set a monthly money review. Look for anomalies, celebrate wins, and note one improvement. Turn it into a small ritual so it does not feel heavy.",
            "Tracking reveals blind spots like fees or unused subscriptions. Cash spending can also hide, so jot cash spends or use a fixed weekly withdrawal.",
            "Use categories to see your needs to wants ratio. The 50/30/20 guideline can help you evaluate balance without being rigid.",
            "Tracking makes you proactive. Instead of asking where money went, you will start telling it where to go.",
          ],
          doItNow: [
            "Open the Logging section and input one day of transactions. Categorize each entry. Set a reminder to log daily for the next week. This is the smallest possible start that builds momentum.",
          ],
          check: [
            {
              question: "If you notice you spent 80 percent of your dining-out budget halfway through the month, what is a smart move?",
              answers: [
                "Stop tracking dining out for the rest of the month.",
                "Acknowledge it and adjust: cook more at home and review the budget.",
                "Transfer money from rent to cover more restaurants.",
              ],
              correctIndex: 1,
            },
            {
              question: "True or False: Small purchases do not matter, so it is fine to skip tracking anything under $5.",
              answers: ["True", "False"],
              correctIndex: 1,
            },
            {
              question: "You find a $9.99 charge for a service you forgot about. What should you do?",
              answers: [
                "Ignore it because it is small.",
                "Investigate and cancel if unused.",
                "Complain but keep it because canceling is hassle.",
              ],
              correctIndex: 1,
            },
          ],
        },
      },
      {
        id: "spend-less-than-you-earn",
        title: "Spend Less Than You Earn (The Golden Rule)",
        layers: {
          quick: [
            "Spend less than you earn. This is the bedrock of financial stability.",
            "If you consistently spend less than your income, you have money left to save, invest, or pay off debt.",
            "Key rule: Income minus expenses should stay positive, even by a little.",
          ],
          practical: [
            "Know your net income. Plan around what hits your bank account, not gross pay.",
            "Compare last month income vs spending and find the gap.",
            "Identify your biggest expenses and look for small reductions in those areas.",
            "Find your wiggle room in wants and choose one or two areas to cut modestly.",
            "Automate the gap by transferring a small amount to savings on payday.",
            "Common mistakes: Underestimating irregular bills, counting on credit to fill the gap, and lifestyle creep after raises.",
            "Example: Marcus earns $4,000 but spends $4,200. He cancels cable and cuts takeout, saving $220. He sets a $50 auto-transfer to savings and now spends less than he earns.",
          ],
          deep: [
            "Spending less than you earn creates a surplus. Even small surpluses add up and fuel savings and growth.",
            "Overspending leads to debt. Carrying balances means you pay interest for past spending.",
            "Surpluses build emergency readiness. Over time you can grow a buffer for unexpected costs.",
            "If it is hard to stay under income, consider both sides: reduce expenses and increase income.",
            "The rule does not mean you cannot enjoy life. It sets a boundary so you can choose what matters most.",
          ],
          doItNow: [
            "Open the budget or cash flow tool. Input your take-home income and major expenses. If expenses are higher, mark one or two areas to reduce. If income is higher, plan to save that difference with a goal or recurring transfer entry.",
          ],
          check: [
            {
              question: "You got a $500 bonus at work. What is the Golden Rule move?",
              answers: [
                "Spend it all because it is extra money.",
                "Use part to pay off debt and put the rest toward savings. A small treat is fine.",
                "Upgrade your lifestyle with a pricier monthly payment.",
              ],
              correctIndex: 1,
            },
            {
              question: "True or False: Following spend less than you earn means you should never use a credit card.",
              answers: ["True", "False"],
              correctIndex: 1,
            },
            {
              question: "If your expenses equal your income with no wiggle room, what is a prudent step?",
              answers: [
                "Spend more because you deserve it.",
                "Find an expense to cut or a way to earn a bit more to create a surplus.",
                "It is fine; use a credit card in an emergency with no consequences.",
              ],
              correctIndex: 1,
            },
          ],
        },
      },
      {
        id: "simple-budgeting",
        title: "Simple Budgeting (Plan Your Money)",
        layers: {
          quick: [
            "Budgeting is a plan for your money. It gives every dollar a job so it does not wander off.",
            "A good budget is not about deprivation. It aligns spending with priorities and lets you spend guilt-free within limits.",
            "Key rule: Give every dollar a purpose.",
          ],
          practical: [
            "Pick a budgeting method. Options include 50/30/20, zero-based, pay-yourself-first, or envelope style.",
            "List categories and assign amounts. Start with needs, then wants, then savings. Make sure it fits your income.",
            "Use the app to enter category limits and see the plan visually.",
            "Track and adjust weekly. Move money between categories if needed while keeping the total in balance.",
            "Review month end, roll over leftovers, and adjust next month using what you learned.",
            "Common mistakes: Making budgets too restrictive, forgetting infrequent expenses, and not adjusting when categories are consistently off.",
            "Example: Amara uses a 60/20/20 split due to high rent. She sets category targets in the app and adjusts groceries after seeing her real usage.",
          ],
          deep: [
            "The best budget is the one you will stick to. Different systems work for different people.",
            "Zero-based budgeting gives every dollar a job. Pay-yourself-first makes saving non-negotiable. The envelope system enforces limits in spending categories.",
            "Budgeting is iterative. Expect to refine categories and include infrequent costs through sinking funds.",
            "If budgets break, treat it as data, not failure. Adjust the plan and keep going.",
            "Budgeting is about intentionality. It reduces stress and helps you see progress toward goals.",
          ],
          doItNow: [
            "Use the Budget feature to set a basic plan for next month. Start with just a few categories like Essentials, Fun, and Savings. Turn on a notification if the app allows it. This creates a simple roadmap right away.",
          ],
          check: [
            {
              question: "If you overspend in one category, what is the best course of action?",
              answers: [
                "Give up because the budget is ruined.",
                "Adjust by moving funds from another category or cutting back elsewhere and note it for next month.",
                "Take out a loan to fill the gap.",
              ],
              correctIndex: 1,
            },
            {
              question: "You budgeted $100 for entertainment, but an event will cost $50 more. What is a responsible way to handle it?",
              answers: [
                "Put the extra $50 on a credit card without thinking.",
                "Reallocate $50 from another category or decide which is more important.",
                "Decline all fun invitations because budgets mean no flexibility.",
              ],
              correctIndex: 1,
            },
            {
              question: "True or False: A budget should remain exactly the same every month without changes.",
              answers: ["True", "False"],
              correctIndex: 1,
            },
          ],
        },
      },
    ],
  },
  {
    id: "read-your-money",
    title: "How To Read Your Money",
    nodes: [
      {
        id: "cash-flow-follow-the-money",
        title: "Cash Flow: Follow the Money",
        layers: {
          quick: [
            "Cash flow is money coming in vs money going out. Learning to read it means understanding where your money goes and when.",
            "Positive cash flow means you are living within your means. Negative cash flow means debt or trouble is brewing.",
            "Key rule: Treat your personal finances like a simple business. Income minus expenses equals profit or loss.",
          ],
          practical: [
            "Map your income sources and note when each arrives.",
            "List fixed expenses and due dates so you know what is spoken for.",
            "Estimate variable spending using your tracking history.",
            "Calendarize paydays and bill due dates so timing never surprises you.",
            "Calculate your monthly bottom line and decide what to do with any surplus or shortfall.",
            "Common mistakes: Ignoring timing, treating irregular income as regular, counting on uncertain future income, and letting expenses rise with income.",
            "Example: Jordan earns $3,200 and spends about $2,300. He plans bill timing around paychecks and saves $450, then adjusts after a road trip changed his gas spend.",
          ],
          deep: [
            "Understanding cash flow is like being the CFO of You. Timing matters as much as totals.",
            "If you are paid biweekly, two months each year have an extra paycheck. Plan those ahead to build savings or pay debt.",
            "Surpluses need a mission or lifestyle creep will absorb them. Shortfalls require either lower spending or higher income.",
            "Track net worth over time. Cash flow is the short-term report card, net worth is the long-term one.",
            "For irregular income, use averages and build a buffer fund to smooth lean months.",
          ],
          doItNow: [
            "Open the cash flow summary and review last month. Note whether it was positive or negative. Write one adjustment you will make next month based on that number.",
          ],
          check: [
            {
              question: "If your income is $2,500 this month and expenses are $2,700, what does that indicate?",
              answers: [
                "You have a $200 negative cash flow and may need savings or debt to cover it.",
                "You are fine because these are just numbers.",
                "You should invest more because you are spending more than you earn.",
              ],
              correctIndex: 0,
            },
            {
              question: "True or False: A positive cash flow every month will always increase net worth if you save the surplus.",
              answers: ["True", "False"],
              correctIndex: 0,
            },
            {
              question: "You get paid on the 15th, but rent is due on the 1st. What is a smart strategy?",
              answers: [
                "Pay late and hope it works out.",
                "Set aside part of the prior paycheck so you are always ahead on rent.",
                "Spend the paycheck and take a payday loan on the 1st.",
              ],
              correctIndex: 1,
            },
          ],
        },
      },
      {
        id: "needs-vs-wants",
        title: "Needs vs Wants: Know the Difference",
        layers: {
          quick: [
            "Needs are essentials you must pay for to live and work. Wants are extras that make life enjoyable.",
            "Neither is bad, but knowing the difference helps you make smarter choices when money is tight.",
            "Key rule: Needs keep you alive and functional. Wants are optional.",
          ],
          practical: [
            "Categorize your recent spending as needs or wants. Be honest.",
            "Review your wants and decide which bring real value for the cost.",
            "Review needs and see if any can be optimized without sacrificing the need.",
            "Set a wants budget so fun spending is guilt-free within limits.",
            "Practice mindfulness on new purchases by labeling them as need or want in the moment.",
            "Common mistakes: Rationalizing wants as needs or cutting all wants and burning out.",
            "Example: Priya marks expenses and sees $320 in wants. She trims one area and reallocates to a want she values more.",
          ],
          deep: [
            "The line between need and want can blur. Focus on the base-level need and treat upgrades as wants.",
            "Lifestyle inflation turns wants into must-haves as income rises. Audit periodically.",
            "Benchmarks like 50/30/20 can help you see whether needs or wants dominate your budget.",
            "Use strategies like wait periods for large purchases or separate fun money accounts to avoid impulse buying.",
            "In tough times, a bare-bones budget helps you triage quickly and cut wants first.",
          ],
          doItNow: [
            "Open your latest expenses and label five items as Need or Want. Pick one want and reduce that category slightly for next month. This builds the habit immediately.",
          ],
          check: [
            {
              question: "Which of these is a need rather than a want?",
              answers: ["Streaming service subscription", "Rent for your apartment", "Tickets to a concert"],
              correctIndex: 1,
            },
            {
              question: "You are spending $100 per month on a want like takeout. What is a sensible strategy?",
              answers: [
                "Cut it to zero immediately and never enjoy it again.",
                "Reduce it to a reasonable amount and cook more at home.",
                "Ignore it because budgeting does not apply to wants.",
              ],
              correctIndex: 1,
            },
            {
              question: "True or False: Upgrading your phone every year is a need in modern life.",
              answers: ["True", "False"],
              correctIndex: 1,
            },
          ],
        },
      },
      {
        id: "understand-your-paycheck",
        title: "Understand Your Paycheck",
        layers: {
          quick: [
            "Gross pay is what you earn before deductions. Net pay is what hits your account.",
            "Deductions include taxes, Social Security, Medicare, benefits, and retirement contributions.",
            "Key rule: Plan your life around net income, not the gross number.",
          ],
          practical: [
            "Grab your latest pay stub and identify gross pay, taxes, benefits, and net pay.",
            "Check tax withholding and adjust if you consistently get large refunds or owe money.",
            "Understand benefits like retirement contributions and insurance so you know what you are funding.",
            "Annualize your net pay to ground your budget. Notice if you have extra paycheck months.",
            "Common mistakes: Budgeting off gross income, not updating withholding after life changes, and ignoring employer matches.",
            "Example: Ben sees his net pay and benefits clearly, confirms he is getting the 401k match, and uses net income for rent decisions.",
          ],
          deep: [
            "Tax withholding is based on your W-4 and uses progressive brackets. Earning more does not reduce your take-home overall.",
            "Benefits are part of compensation. Employer matches and subsidized insurance add real value.",
            "Pre-tax deductions like retirement or health savings accounts can lower taxable income and stretch dollars.",
            "Self-employed income requires you to create your own pay stub by setting aside taxes and benefits.",
            "Pay frequency affects budgeting. Biweekly pay creates two extra paycheck months that can accelerate goals.",
          ],
          doItNow: [
            "Review your latest pay stub and jot down gross pay, net pay, and one deduction you want to understand better. Make sure your budget uses the net number.",
          ],
          check: [
            {
              question: "You got a raise from $50k to $55k gross. How will this affect take-home pay?",
              answers: [
                "It will increase by $5k per year exactly.",
                "It will increase by less than $5k because taxes and deductions take a portion.",
                "It will not increase because higher brackets reduce take-home pay.",
              ],
              correctIndex: 1,
            },
            {
              question: "You have paid $5,000 in federal taxes year-to-date and expect $6,000 total. What does that imply?",
              answers: [
                "You might owe around $1,000 if things continue similarly.",
                "You will definitely get a refund.",
                "It does not tell you anything.",
              ],
              correctIndex: 0,
            },
            {
              question: "True or False: Contributing to a 401(k) reduces current taxable income and shows as a deduction on your pay stub.",
              answers: ["True", "False"],
              correctIndex: 0,
            },
          ],
        },
      },
    ],
  },
  {
    id: "recurring-costs",
    title: "Recurring Costs and Blind Spots",
    nodes: [],
  },
  {
    id: "building-habits",
    title: "Building Good Habits and Systems",
    nodes: [],
  },
  {
    id: "safety",
    title: "Safety (Debt, Credit, Insurance, Emergency)",
    nodes: [],
  },
  {
    id: "grow",
    title: "Grow (Investing, Taxes, Income Growth)",
    nodes: [],
  },
];

export default function HelpPage() {
  const [expandedModule, setExpandedModule] = useState<string | null>("start-here");
  const [expandedNode, setExpandedNode] = useState<string | null>("money-mindset-goals");
  const [expandedLayers, setExpandedLayers] = useState<Record<string, Record<LayerId, boolean>>>({});

  function toggleModule(id: string) {
    setExpandedModule(expandedModule === id ? null : id);
  }

  function toggleNode(id: string) {
    setExpandedNode(expandedNode === id ? null : id);
  }

  function toggleLayer(nodeId: string, layerId: LayerId) {
    setExpandedLayers((prev) => {
      const nodeLayers = prev[nodeId] ?? {};
      return { ...prev, [nodeId]: { ...nodeLayers, [layerId]: !nodeLayers[layerId] } };
    });
  }

  function isLayerOpen(nodeId: string, layerId: LayerId) {
    if (layerId === "quick") {
      return expandedLayers[nodeId]?.[layerId] ?? true;
    }
    return expandedLayers[nodeId]?.[layerId] ?? false;
  }

  function renderLine(line: string, key: string) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith("key rule:")) {
      const rule = trimmed.replace(/key rule:/i, "").trim();
      return (
        <div
          key={key}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-body"
          style={{ backgroundColor: "var(--primary-subtle)", color: "var(--text)" }}
        >
          <Lucide.Star className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <span className="font-medium">Key rule:</span>
          <span>{rule}</span>
        </div>
      );
    }

    if (lower.startsWith("common mistakes:")) {
      const content = trimmed.replace(/common mistakes:/i, "").trim();
      return (
        <div
          key={key}
          className="flex gap-2 rounded-lg px-3 py-2 text-body"
          style={{ backgroundColor: "var(--warning-subtle)", color: "var(--text)" }}
        >
          <Lucide.AlertTriangle className="h-4 w-4 mt-0.5" style={{ color: "var(--warning)" }} />
          <div>
            <span className="font-medium">Common mistakes:</span> {content}
          </div>
        </div>
      );
    }

    if (lower.startsWith("example:")) {
      const content = trimmed.replace(/example:/i, "").trim();
      return (
        <div
          key={key}
          className="flex gap-2 rounded-lg px-3 py-2 text-body"
          style={{ backgroundColor: "var(--success-subtle)", color: "var(--text)" }}
        >
          <Lucide.Lightbulb className="h-4 w-4 mt-0.5" style={{ color: "var(--success)" }} />
          <div>
            <span className="font-medium">Example:</span> {content}
          </div>
        </div>
      );
    }

    return (
      <p key={key} className="text-body leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {trimmed}
      </p>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h1 className="text-h1 mb-2" style={{ color: "var(--text)" }}>
          Learn
        </h1>
        <p className="text-body" style={{ color: "var(--text-secondary)" }}>
          Clear, practical financial education. Tap modules to learn step by step and reveal deeper layers.
        </p>
      </div>

      <div className="space-y-3">
        {MODULES.map((module) => {
          const isExpanded = expandedModule === module.id;
          const moduleStyle = MODULE_STYLES[module.id];
          const ModuleIcon = moduleStyle.icon;

          return (
            <div
              key={module.id}
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${moduleStyle.color}20` }}
                >
                  <ModuleIcon className="h-5 w-5" style={{ color: moduleStyle.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                    {module.title}
                  </div>
                  <div className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                    {module.nodes.length} lesson{module.nodes.length === 1 ? "" : "s"}
                  </div>
                </div>
                <Lucide.ChevronDown
                  className="h-5 w-5 shrink-0 transition-transform"
                  style={{
                    color: "var(--text-tertiary)",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    {module.nodes.map((node) => {
                      const isNodeExpanded = expandedNode === node.id;

                      return (
                        <div
                          key={node.id}
                          className="rounded-xl p-3 space-y-3"
                          style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
                        >
                          <button
                            onClick={() => toggleNode(node.id)}
                            className="w-full flex items-center justify-between text-left"
                          >
                            <div>
                              <div className="text-body font-semibold" style={{ color: "var(--text)" }}>
                                {node.title}
                              </div>
                            </div>
                            <Lucide.ChevronDown
                              className="h-4 w-4 transition-transform"
                              style={{
                                color: "var(--text-tertiary)",
                                transform: isNodeExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                            />
                          </button>

                          {isNodeExpanded && (
                            <div className="space-y-4">
                              {LAYER_ORDER.map((layerId) => {
                                const layerStyle = LAYER_STYLES[layerId];
                                const LayerIcon = layerStyle.icon;
                                const isOpen = isLayerOpen(node.id, layerId);

                                return (
                                  <div
                                    key={`${node.id}-${layerId}`}
                                    className="rounded-xl overflow-hidden"
                                    style={{ border: `1px solid ${layerStyle.border}40`, backgroundColor: "var(--surface)" }}
                                  >
                                    <button
                                      onClick={() => toggleLayer(node.id, layerId)}
                                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                                      style={{ backgroundColor: `${layerStyle.color}12` }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <LayerIcon className="h-4 w-4" style={{ color: layerStyle.color }} />
                                        <span className="text-meta font-semibold" style={{ color: "var(--text)" }}>
                                          {layerStyle.title}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-meta" style={{ color: "var(--text-tertiary)" }}>
                                          {layerId === "check"
                                            ? `${node.layers.check.length} checks`
                                            : `${node.layers[layerId].length} notes`}
                                        </span>
                                        <Lucide.ChevronDown
                                          className="h-4 w-4 transition-transform"
                                          style={{
                                            color: "var(--text-tertiary)",
                                            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                          }}
                                        />
                                      </div>
                                    </button>

                                    {isOpen && (
                                      <div className="space-y-3 px-3 py-3">
                                        {layerId === "check" ? (
                                          node.layers.check.map((check, idx) => (
                                            <div
                                              key={`${node.id}-check-${idx}`}
                                              className="rounded-lg p-3"
                                              style={{ backgroundColor: "var(--surface-2)" }}
                                            >
                                              <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                                                {check.question}
                                              </div>
                                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                                {check.answers.map((answer, answerIdx) => (
                                                  <div
                                                    key={`${node.id}-answer-${answer}`}
                                                    className="rounded-lg px-3 py-2 text-meta"
                                                    style={{
                                                      backgroundColor:
                                                        answerIdx === check.correctIndex
                                                          ? "var(--success-subtle)"
                                                          : "var(--surface)",
                                                      color:
                                                        answerIdx === check.correctIndex ? "var(--text)" : "var(--text-secondary)",
                                                      border: "1px solid var(--border)",
                                                    }}
                                                  >
                                                    <span className="font-semibold">
                                                      {String.fromCharCode(65 + answerIdx)}.
                                                    </span>{" "}
                                                    {answer}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          node.layers[layerId].map((line, idx) =>
                                            renderLine(line, `${node.id}-${layerId}-${idx}`)
                                          )
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="rounded-2xl p-4 text-center"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="text-meta" style={{ color: "var(--text-tertiary)" }}>
          TallyUp · Financial awareness without judgment
        </div>
      </div>
    </div>
  );
}
