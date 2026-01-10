"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { formatMoney } from "@/components/utils";
import { useToast } from "@/components/ToastProvider";
import TimeRangeControl from "@/components/TimeRangeControl";
import { useTimeRange } from "@/components/TimeRangeProvider";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type AccountType =
  | "credit"
  | "checking"
  | "savings"
  | "investment"
  | "loan"
  | "business"
  | "other";

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

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const accountId = params?.id as Id<"accounts">;

  const { startDate, endDate } = useTimeRange();
  const [showUpdate, setShowUpdate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [balanceInput, setBalanceInput] = useState("");
  const [asOfDate, setAsOfDate] = useState(getNowDateInput());
  const [asOfTime, setAsOfTime] = useState(getNowTimeInput());

  const [editName, setEditName] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editLast4, setEditLast4] = useState("");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editApr, setEditApr] = useState("");
  const [editInterestRate, setEditInterestRate] = useState("");
  const [editMinPayment, setEditMinPayment] = useState("");
  const [editShowSelector, setEditShowSelector] = useState(true);

  const data = useQuery(api.accounts.getAccountWithSnapshots, {
    accountId,
    startDate,
    endDate,
    limit: 600,
  }) as
    | {
        account: {
          _id: Id<"accounts">;
          name: string;
          type: AccountType;
          institutionName?: string;
          last4?: string;
          creditLimit?: number;
          apr?: number;
          interestRate?: number;
          minPayment?: number;
          showInTransactionSelector?: boolean;
        };
        latestSnapshot?: { balance: number; asOf: number } | null;
        snapshots: { _id: string; balance: number; asOf: number }[];
      }
    | null
    | undefined;

  const addSnapshot = useMutation(api.accounts.addAccountSnapshot);
  const updateAccount = useMutation(api.accounts.updateAccount);

  const account = data?.account;
  const latestSnapshot = data?.latestSnapshot;

  const chartData = useMemo(() => {
    const rows = [...(data?.snapshots ?? [])]
      .sort((a, b) => a.asOf - b.asOf)
      .map((snap) => ({
        asOf: snap.asOf,
        balance: snap.balance,
      }));
    return rows;
  }, [data?.snapshots]);

  const handleUpdateBalance = async () => {
    const cents = Math.round(parseFloat(balanceInput) * 100);
    if (!Number.isFinite(cents)) {
      toast.error("Enter a valid balance");
      return;
    }
    try {
      await addSnapshot({
        accountId,
        balance: cents,
        asOf: parseDateTime(asOfDate, asOfTime),
      });
      toast.success("Balance updated");
      setShowUpdate(false);
      setBalanceInput("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast.error("Failed to update balance", { description: message });
    }
  };

  const handleOpenEdit = () => {
    if (!account) return;
    setEditName(account.name);
    setEditInstitution(account.institutionName ?? "");
    setEditLast4(account.last4 ?? "");
    setEditCreditLimit(account.creditLimit ? (account.creditLimit / 100).toFixed(2) : "");
    setEditApr(account.apr ? account.apr.toString() : "");
    setEditInterestRate(account.interestRate ? account.interestRate.toString() : "");
    setEditMinPayment(account.minPayment ? (account.minPayment / 100).toFixed(2) : "");
    setEditShowSelector(account.showInTransactionSelector ?? true);
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!account) return;
    try {
      await updateAccount({
        id: account._id,
        name: editName.trim(),
        institutionName: editInstitution.trim() || undefined,
        last4: editLast4.trim() || undefined,
        creditLimit: editCreditLimit ? Math.round(parseFloat(editCreditLimit) * 100) : undefined,
        apr: editApr ? parseFloat(editApr) : undefined,
        interestRate: editInterestRate ? parseFloat(editInterestRate) : undefined,
        minPayment: editMinPayment ? Math.round(parseFloat(editMinPayment) * 100) : undefined,
        showInTransactionSelector: editShowSelector,
      });
      toast.success("Account updated");
      setShowEdit(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast.error("Failed to update account", { description: message });
    }
  };

  const handleArchive = async () => {
    if (!account) return;
    try {
      await updateAccount({ id: account._id, isArchived: true });
      toast.success("Account archived");
      router.push("/accounts");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast.error("Failed to archive account", { description: message });
    }
  };

  if (!account) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--text-tertiary)" }}>
        Loading account...
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title={account.name}
        subtitle="Snapshots tell the real story."
        rightSlot={
          <div className="flex items-center gap-2">
            <TimeRangeControl />
            <button
              onClick={handleOpenEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
            >
              <Lucide.Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>
        }
      />

      <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
          Current balance
        </div>
        <div className="text-3xl font-bold" style={{ color: "var(--text)" }}>
          {latestSnapshot ? formatMoney(latestSnapshot.balance) : "—"}
        </div>
        <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          As of {latestSnapshot?.asOf ? new Date(latestSnapshot.asOf).toLocaleString() : "—"}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => {
              setAsOfDate(getNowDateInput());
              setAsOfTime(getNowTimeInput());
              setShowUpdate(true);
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
          >
            Update balance
          </button>
          <button
            onClick={handleArchive}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)" }}
          >
            Archive account
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Snapshot trend
          </div>
        </div>
        <div className="h-48">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: "var(--text-tertiary)" }}>
              Add another snapshot to see the chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis
                  dataKey="asOf"
                  tickFormatter={(value: number | string) =>
                    new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  }
                  tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value: number | string) =>
                    formatMoney(typeof value === "number" ? value : Number(value))
                  }
                  tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <Tooltip
                  formatter={(value: number) => formatMoney(value)}
                  labelFormatter={(label: number | string) => new Date(label).toLocaleString()}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Snapshot history
        </div>
        <div className="space-y-2">
          {(data?.snapshots ?? []).map((snap) => (
            <div
              key={snap._id}
              className="flex items-center justify-between rounded-xl p-3"
              style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {formatMoney(snap.balance)}
                </div>
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {new Date(snap.asOf).toLocaleString()}
                </div>
              </div>
              <Lucide.ChevronRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
            </div>
          ))}
        </div>
      </div>

      {showUpdate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUpdate(false)} />
          <div
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                Update balance
              </h2>
              <button onClick={() => setShowUpdate(false)}>
                <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
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
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowUpdate(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateBalance}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                >
                  Save update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEdit(false)} />
          <div
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                Edit account
              </h2>
              <button onClick={() => setShowEdit(false)}>
                <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Nickname
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Institution
                </label>
                <input
                  value={editInstitution}
                  onChange={(e) => setEditInstitution(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Last 4
                </label>
                <input
                  value={editLast4}
                  onChange={(e) => setEditLast4(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                />
              </div>
              {account.type === "credit" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Credit limit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editCreditLimit}
                      onChange={(e) => setEditCreditLimit(e.target.value)}
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
                      value={editApr}
                      onChange={(e) => setEditApr(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                  </div>
                </>
              )}
              {account.type === "loan" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Interest rate %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editInterestRate}
                      onChange={(e) => setEditInterestRate(e.target.value)}
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
                      value={editMinPayment}
                      onChange={(e) => setEditMinPayment(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }}
                    />
                  </div>
                </>
              )}
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={editShowSelector}
                  onChange={(e) => setEditShowSelector(e.target.checked)}
                />
                Show in transaction selector
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowEdit(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
