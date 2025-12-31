"use client";

import { useState } from "react";
import * as Lucide from "lucide-react";
import { useTabs } from "@/components/PersistentTabs";

/**
 * Help Page - Financial Literacy Guidance
 * 
 * Contextual financial education, not FAQs.
 * Plain language, no accounting jargon, self-contained.
 */

interface Section {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  content: ContentBlock[];
}

interface ContentBlock {
  type: "heading" | "paragraph" | "tip" | "warning" | "list";
  text?: string;
  items?: string[];
}

const SECTIONS: Section[] = [
  {
    id: "reading-money",
    title: "How to Read Your Money",
    icon: Lucide.BookOpen,
    color: "var(--primary)",
    content: [
      {
        type: "heading",
        text: "Net vs Cash Flow",
      },
      {
        type: "paragraph",
        text: "Your net is simply income minus expenses. A positive number means you kept more than you spent. A negative number means you spent more than you earned. Neither is inherently good or bad—it depends on your situation.",
      },
      {
        type: "tip",
        text: "A negative month isn't failure. Sometimes you need to spend on something important. What matters is whether it was intentional.",
      },
      {
        type: "heading",
        text: "Why \"Over Budget\" ≠ Failure",
      },
      {
        type: "paragraph",
        text: "Budgets are guidelines, not laws. Going over in one category often means you're under in another. The goal is awareness, not perfection. If you consistently overspend in one area, that's information—maybe your budget needs adjusting to match reality.",
      },
      {
        type: "heading",
        text: "Irregular Income Explained",
      },
      {
        type: "paragraph",
        text: "If your income varies month to month (freelance, gig work, commissions), don't compare yourself to a steady paycheck. Instead, track your rolling average over 3-6 months. Some months will be high, others low—that's normal.",
      },
      {
        type: "list",
        items: [
          "Track your lowest 3 months to find your baseline",
          "Build a buffer for low-income months",
          "Celebrate high months, but don't spend as if they'll repeat",
        ],
      },
    ],
  },
  {
    id: "income-fragmentation",
    title: "Income Fragmentation",
    icon: Lucide.Split,
    color: "var(--success)",
    content: [
      {
        type: "heading",
        text: "Multiple Income Streams",
      },
      {
        type: "paragraph",
        text: "Having income from multiple sources (gig work, side jobs, investments) is increasingly common. This is actually more stable than a single job—if one source drops, others continue.",
      },
      {
        type: "heading",
        text: "Gig Work & Platform Income",
      },
      {
        type: "paragraph",
        text: "When you work for platforms like Uber, DoorDash, or Upwork, remember: the money you receive isn't all profit. A portion goes to expenses (gas, vehicle wear, equipment). Track your true hourly rate by subtracting costs.",
      },
      {
        type: "tip",
        text: "Log your hours when you log gig income. This helps you see your real earnings per hour—information that helps you decide which gigs are worth your time.",
      },
      {
        type: "heading",
        text: "Reimbursements",
      },
      {
        type: "paragraph",
        text: "Money that comes back to you (expense reimbursements, returns, refunds) isn't really income—it's money returning home. TallyUp lets you mark these to exclude from your income totals so your numbers stay accurate.",
      },
      {
        type: "heading",
        text: "Transfers vs Earnings",
      },
      {
        type: "paragraph",
        text: "Moving money between your own accounts isn't income or spending—it's just money relocating. Be careful not to count transfers as income, or you'll think you have more than you do.",
      },
      {
        type: "warning",
        text: "Moving $500 from checking to savings isn't $500 spent. It's still your money, just in a different place.",
      },
    ],
  },
  {
    id: "recurring-costs",
    title: "Recurring Costs & Blind Spots",
    icon: Lucide.RefreshCw,
    color: "var(--warning)",
    content: [
      {
        type: "heading",
        text: "The Subscription Creep",
      },
      {
        type: "paragraph",
        text: "Small monthly charges add up. A $10/month subscription is $120/year. Five of them? $600. Review your recurring charges periodically—you might be paying for things you forgot about or no longer use.",
      },
      {
        type: "heading",
        text: "Variable Subscriptions",
      },
      {
        type: "paragraph",
        text: "Some bills aren't the same each month: utilities, phone data overages, usage-based services. Track these separately from fixed costs. Knowing your average helps you budget more accurately.",
      },
      {
        type: "heading",
        text: "Semi-Predictable Expenses",
      },
      {
        type: "paragraph",
        text: "Some expenses happen regularly but not monthly: oil changes, haircuts, annual subscriptions. These catch people off guard because they're not in the monthly mental model.",
      },
      {
        type: "list",
        items: [
          "Car maintenance: every 3-6 months",
          "Annual subscriptions: once a year (but easy to forget)",
          "Seasonal expenses: heating in winter, cooling in summer",
          "Medical: annual checkups, prescriptions",
        ],
      },
      {
        type: "tip",
        text: "Create sinking funds for these predictable-but-not-monthly expenses. Set aside a small amount each month so you're ready when they hit.",
      },
      {
        type: "heading",
        text: "Why Averages Matter",
      },
      {
        type: "paragraph",
        text: "Looking at a single month can be misleading. Some months have extra paydays, some have annual bills. A 3-month or 6-month average gives you a truer picture of your typical spending.",
      },
    ],
  },
  {
    id: "behavioral-guidance",
    title: "Building Good Habits",
    icon: Lucide.Sparkles,
    color: "var(--chart-5)",
    content: [
      {
        type: "heading",
        text: "The Review Cadence",
      },
      {
        type: "paragraph",
        text: "Financial awareness comes from regular check-ins, not occasional deep dives. A weekly 5-minute review beats a monthly hour-long session. You'll catch issues early and stay connected to your money.",
      },
      {
        type: "list",
        items: [
          "Daily: Log transactions as they happen (takes seconds)",
          "Weekly: Quick review of the past 7 days (5 minutes)",
          "Monthly: Look at totals, trends, and upcoming expenses (15 minutes)",
          "Quarterly: Bigger picture—are you moving toward your goals?",
        ],
      },
      {
        type: "heading",
        text: "Tagging Discipline",
      },
      {
        type: "paragraph",
        text: "The more consistently you categorize transactions, the more useful your data becomes. Don't overthink it—a simple system you actually use beats a complex one you don't.",
      },
      {
        type: "tip",
        text: "When unsure about a category, pick the most likely one and move on. You can always edit it later. Progress over perfection.",
      },
      {
        type: "heading",
        text: "Reality-Based Budgeting",
      },
      {
        type: "paragraph",
        text: "Budgets should reflect how you actually spend, not how you wish you spent. Start by tracking for a month with no budget. Then set budgets based on what you actually see. Adjust from there.",
      },
      {
        type: "warning",
        text: "Setting unrealistic budgets leads to guilt and abandonment. A budget you can stick to is infinitely better than one that makes you feel bad.",
      },
      {
        type: "heading",
        text: "The Power of Logging",
      },
      {
        type: "paragraph",
        text: "The act of logging a transaction makes you more conscious of your spending. Studies show people spend less simply by tracking—even without a budget. Awareness itself is powerful.",
      },
    ],
  },
];

export default function HelpPage() {
  const { setActiveTab } = useTabs();
  const [expandedSection, setExpandedSection] = useState<string | null>("reading-money");

  function toggleSection(id: string) {
    setExpandedSection(expandedSection === id ? null : id);
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h1 className="text-h1 mb-2" style={{ color: "var(--text)" }}>
          Learn
        </h1>
        <p className="text-body" style={{ color: "var(--text-secondary)" }}>
          Practical money knowledge, not financial jargon. Learn to read your finances honestly and build sustainable habits.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setActiveTab("dashboard")}
          className="rounded-xl p-4 text-left"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Lucide.LayoutDashboard className="h-5 w-5 mb-2" style={{ color: "var(--primary)" }} />
          <div className="text-body font-medium" style={{ color: "var(--text)" }}>Dashboard</div>
          <div className="text-meta" style={{ color: "var(--text-secondary)" }}>View your overview</div>
        </button>
        <button
          onClick={() => setActiveTab("recurring")}
          className="rounded-xl p-4 text-left"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Lucide.RefreshCw className="h-5 w-5 mb-2" style={{ color: "var(--warning)" }} />
          <div className="text-body font-medium" style={{ color: "var(--text)" }}>Recurring</div>
          <div className="text-meta" style={{ color: "var(--text-secondary)" }}>Track patterns</div>
        </button>
      </div>

      {/* Content Sections */}
      <div className="space-y-3">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;

          return (
            <div
              key={section.id}
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${section.color}20` }}
                >
                  <Icon className="h-5 w-5" style={{ color: section.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-medium" style={{ color: "var(--text)" }}>
                    {section.title}
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
                  <div className="space-y-4 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    {section.content.map((block, idx) => {
                      switch (block.type) {
                        case "heading":
                          return (
                            <h3
                              key={idx}
                              className="text-body font-semibold pt-2"
                              style={{ color: "var(--text)" }}
                            >
                              {block.text}
                            </h3>
                          );
                        case "paragraph":
                          return (
                            <p
                              key={idx}
                              className="text-body leading-relaxed"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {block.text}
                            </p>
                          );
                        case "tip":
                          return (
                            <div
                              key={idx}
                              className="flex gap-3 p-3 rounded-xl"
                              style={{ backgroundColor: "var(--success-subtle)" }}
                            >
                              <Lucide.Lightbulb className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--success)" }} />
                              <p className="text-body" style={{ color: "var(--text)" }}>
                                {block.text}
                              </p>
                            </div>
                          );
                        case "warning":
                          return (
                            <div
                              key={idx}
                              className="flex gap-3 p-3 rounded-xl"
                              style={{ backgroundColor: "var(--warning-subtle)" }}
                            >
                              <Lucide.AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--warning)" }} />
                              <p className="text-body" style={{ color: "var(--text)" }}>
                                {block.text}
                              </p>
                            </div>
                          );
                        case "list":
                          return (
                            <ul key={idx} className="space-y-2 pl-4">
                              {block.items?.map((item, i) => (
                                <li
                                  key={i}
                                  className="text-body flex items-start gap-2"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  <span style={{ color: "var(--primary)" }}>•</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          );
                        default:
                          return null;
                      }
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* App Info */}
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
