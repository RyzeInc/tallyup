"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ToastProvider";

type AccountType =
  | "credit"
  | "checking"
  | "savings"
  | "investment"
  | "loan"
  | "business"
  | "other";

const TYPE_OPTIONS: {
  key: AccountType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}[] = [
  { key: "credit", title: "Credit", description: "Cards and revolving lines", icon: Lucide.CreditCard },
  { key: "checking", title: "Checking", description: "Everyday cash flow", icon: Lucide.Landmark },
  { key: "savings", title: "Savings", description: "Buckets and reserves", icon: Lucide.PiggyBank },
  { key: "investment", title: "Investments", description: "Brokerage and holdings", icon: Lucide.TrendingUp },
  { key: "loan", title: "Loans & Debt", description: "Installments you owe", icon: Lucide.Percent },
  { key: "business", title: "Business", description: "Company accounts", icon: Lucide.Briefcase },
  { key: "other", title: "Other", description: "Anything else", icon: Lucide.Folder },
];

function getNowDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function getNowTimeInput() {
  return new Date().toTimeString().slice(0, 5);
}

function parseDateTime(dateValue: string, timeValue: string) {
  const dateTime = new Date(`${dateValue}T${timeValue}`);
  return dateTime.getTime();
}

export default function AddAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const createAccount = useMutation(api.accounts.createAccount);

  const initialType = useMemo(() => {
    const t = (searchParams?.get("type") ?? "") as AccountType;
    return TYPE_OPTIONS.some((opt) => opt.key === t) ? t : "checking";
  }, [searchParams]);

  const [step, setStep] = useState(0);
  const [type, setType] = useState<AccountType>(initialType);
  const [name, setName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [last4, setLast4] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(getNowDateInput());
  const [asOfTime, setAsOfTime] = useState(getNowTimeInput());
  const [creditLimit, setCreditLimit] = useState("");
  const [apr, setApr] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [minPayment, setMinPayment] = useState("");
  const [valuationMode, setValuationMode] = useState<"totalOnly">("totalOnly");
  const [showInSelector, setShowInSelector] = useState(true);
  const [saving, setSaving] = useState(false);

  const stepLabels = ["Type", "Basics", "Starting balance", "Details", "Linking"];

  const canContinue = useMemo(() => {
    if (step === 0) return !!type;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return !!startingBalance.trim() && !Number.isNaN(parseFloat(startingBalance));
    return true;
  }, [step, type, name, startingBalance]);

  const handleNext = () => {
    if (!canContinue) return;
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    const balanceCents = Math.round(parseFloat(startingBalance) * 100);
    if (!Number.isFinite(balanceCents)) {
      toast.error("Enter a valid starting balance");
      return;
    }
    setSaving(true);
    try {
      await createAccount({
        name: name.trim(),
        type,
        institutionName: institutionName.trim() || undefined,
        last4: last4.trim() || undefined,
        creditLimit: creditLimit ? Math.round(parseFloat(creditLimit) * 100) : undefined,
        apr: apr ? parseFloat(apr) : undefined,
        interestRate: interestRate ? parseFloat(interestRate) : undefined,
        minPayment: minPayment ? Math.round(parseFloat(minPayment) * 100) : undefined,
        valuationMode,
        showInTransactionSelector: showInSelector,
        initialBalance: balanceCents,
        asOf: parseDateTime(asOfDate, asOfTime),
      });
      toast.success("Account created");
      router.push("/accounts");
    } catch (e: any) {
      toast.error("Failed to create account", { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Add account"
        subtitle="Manual-first setup in short steps."
      />

      <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
          Step {step + 1} of 5 · {stepLabels[step]}
        </div>

        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = type === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setType(opt.key)}
                  className="flex items-start gap-3 p-3 rounded-xl text-left"
                  style={{
                    backgroundColor: selected ? "var(--accent-subtle)" : "var(--surface-2)",
                    border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
                  }}
                >
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--surface)" }}>
                    <Icon className="h-4 w-4" style={{ color: "var(--text)" }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {opt.title}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {opt.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Nickname *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Daily Checking"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Institution
              </label>
              <input
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g., Chase"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Last 4 digits
              </label>
              <input
                value={last4}
                onChange={(e) => setLast4(e.target.value)}
                placeholder="1234"
                maxLength={4}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Starting balance *
              </label>
              <input
                type="number"
                step="0.01"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  As of date
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Time
                </label>
                <input
                  type="time"
                  value={asOfTime}
                  onChange={(e) => setAsOfTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 mt-4">
            {type === "credit" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Credit limit
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    APR %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={apr}
                    onChange={(e) => setApr(e.target.value)}
                    placeholder="19.9"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Minimum payment
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={minPayment}
                    onChange={(e) => setMinPayment(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>
              </>
            )}
            {type === "loan" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Interest rate %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="4.9"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Minimum payment
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={minPayment}
                    onChange={(e) => setMinPayment(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                  />
                </div>
              </>
            )}
            {type === "investment" && (
              <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-2)" }}>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  Valuation mode
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                  Total balance only keeps manual updates clean and fast.
                </div>
                <button
                  onClick={() => setValuationMode("totalOnly")}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                >
                  Total only
                </button>
              </div>
            )}
            {type !== "credit" && type !== "loan" && type !== "investment" && (
              <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                No extra details needed for this account type.
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 mt-4">
            <div className="rounded-xl p-3" style={{ backgroundColor: "var(--surface-2)" }}>
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                Show this account in payment selector
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                When enabled, the account appears in transaction forms.
              </div>
              <label className="flex items-center gap-2 mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={showInSelector}
                  onChange={(e) => setShowInSelector(e.target.checked)}
                />
                Enable account selector
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
          >
            Back
          </button>
          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canContinue}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
            >
              {saving ? "Saving..." : "Create account"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
