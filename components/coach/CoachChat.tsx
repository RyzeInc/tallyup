"use client";

import { useAction, useConvex, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { formatMoney, formatDateLabel } from "@/components/utils";
import type { CoachProfileUpdate } from "@/lib/coach/profile";
import type { CoachFoundationUpdate } from "@/lib/coach/foundation";
import { formatProfileUpdate } from "@/lib/coach/formatProfile";
import { formatFoundationUpdate } from "@/lib/coach/formatFoundation";

const SNAPSHOT_TTL_MS = 90 * 1000;

type CoachSnapshot = {
  contextHash: string;
  snapshot: {
    monthLabel: string;
    cashflow: {
      incomeCents: number;
      expenseCents: number;
      netCents: number;
    };
    topCategories: Array<{ category: string; amountCents: number }>;
    upcomingBills: Array<{ name: string; expectedDate: number; expectedAmountCents?: number }>;
    anomalies: Array<{ category: string; deltaCents: number; reason: string }>;
    currentFocus: string | null;
    recentSummaries: string[];
    updatedAt: number;
    foundation?: { updatedAt: number; hasFoundation: boolean };
  };
};

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function CoachChat() {
  const convex = useConvex();
  const sendMessage = useAction(api.coach.chat);
  const updateCoachState = useMutation(api.coach.updateCoachState);
  const updateCoachFoundation = useMutation(api.coach.updateCoachFoundation);
  const setTransactionDrilldownOptIn = useMutation(api.coach.setTransactionDrilldownOptIn);
  const resetSession = useMutation(api.coach.resetSession);

  const [snapshot, setSnapshot] = useState<CoachSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const snapshotCache = useRef<{ data: CoachSnapshot; fetchedAt: number } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [contextHash, setContextHash] = useState<string | null>(null);
  const [profileUpdate, setProfileUpdate] = useState<CoachProfileUpdate | null>(null);
  const [foundationUpdate, setFoundationUpdate] = useState<CoachFoundationUpdate | null>(null);
  const [drilldownRequest, setDrilldownRequest] = useState<{ reason: string; windowDays: number } | null>(null);
  const [applyingProfile, setApplyingProfile] = useState(false);
  const [applyingFoundation, setApplyingFoundation] = useState(false);
  const [enablingDrilldown, setEnablingDrilldown] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      const now = Date.now();
      if (snapshotCache.current && now - snapshotCache.current.fetchedAt < SNAPSHOT_TTL_MS) {
        setSnapshot(snapshotCache.current.data);
        setContextHash(snapshotCache.current.data.contextHash);
        setSnapshotLoading(false);
        return;
      }

      setSnapshotLoading(true);
      setSnapshotError(null);

      try {
        const data = await convex.query(api.coach.getSnapshot, {});
        if (!cancelled && data) {
          snapshotCache.current = { data, fetchedAt: Date.now() };
          setSnapshot(data);
          setContextHash(data.contextHash);
        }
      } catch {
        if (!cancelled) {
          setSnapshotError("Unable to load coach snapshot.");
        }
      } finally {
        if (!cancelled) setSnapshotLoading(false);
      }
    };

    loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [convex]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setSending(true);

    try {
      const result = await sendMessage({
        message: trimmed,
        clientContextHash: contextHash ?? undefined,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.assistantMessage }]);
      setActions(result.actions ?? []);
      setFollowUps(result.followUps ?? []);
      setProfileUpdate(result.profileUpdates ?? null);
      setFoundationUpdate(result.foundationUpdates ?? null);
      setDrilldownRequest(result.transactionDrilldownRequest ?? null);
      if (result.contextHash) setContextHash(result.contextHash);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I ran into a problem. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleApplyProfile = async () => {
    if (!profileUpdate || applyingProfile) return;
    setApplyingProfile(true);
    try {
      await updateCoachState({ update: profileUpdate });
      setProfileUpdate(null);
    } finally {
      setApplyingProfile(false);
    }
  };

  const handleApplyFoundation = async () => {
    if (!foundationUpdate || applyingFoundation) return;
    setApplyingFoundation(true);
    try {
      await updateCoachFoundation({ update: foundationUpdate });
      setFoundationUpdate(null);
    } finally {
      setApplyingFoundation(false);
    }
  };

  const handleEnableDrilldown = async () => {
    if (!drilldownRequest || enablingDrilldown) return;
    setEnablingDrilldown(true);
    try {
      await setTransactionDrilldownOptIn({ windowDays: drilldownRequest.windowDays, enabled: true });
      setDrilldownRequest(null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Transaction detail sharing is enabled for the next hour. Ask me to review leaks or transfers." },
      ]);
    } finally {
      setEnablingDrilldown(false);
    }
  };

  const handleResetSession = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await resetSession({});
      // Clear local state
      setMessages([]);
      setActions([]);
      setFollowUps([]);
      setProfileUpdate(null);
      setFoundationUpdate(null);
      setDrilldownRequest(null);
      setContextHash(null);
      // Invalidate snapshot cache
      snapshotCache.current = null;
      // Reload snapshot
      const data = await convex.query(api.coach.getSnapshot, {});
      if (data) {
        snapshotCache.current = { data, fetchedAt: Date.now() };
        setSnapshot(data);
        setContextHash(data.contextHash);
      }
    } finally {
      setResetting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const snapshotContent = snapshot?.snapshot;

  return (
    <div className="space-y-4 pb-6">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Coach Snapshot</CardTitle>
            <CardDescription>
              {snapshotContent ? `Updated ${formatDateLabel(snapshotContent.updatedAt)}` : "Alpha-safe overview"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshotLoading && <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading snapshot...</div>}
            {snapshotError && <div className="text-sm" style={{ color: "var(--danger)" }}>{snapshotError}</div>}
            {!snapshotLoading && snapshotContent && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    {snapshotContent.monthLabel}
                  </div>
                  <div className="text-lg font-semibold">{formatMoney(snapshotContent.cashflow.netCents)}</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Income {formatMoney(snapshotContent.cashflow.incomeCents)} - Expenses {formatMoney(snapshotContent.cashflow.expenseCents)}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Top Categories</div>
                  <div className="space-y-1 text-sm">
                    {snapshotContent.topCategories.length === 0 && (
                      <div style={{ color: "var(--text-secondary)" }}>No spend data yet.</div>
                    )}
                    {snapshotContent.topCategories.map((row) => (
                      <div key={row.category} className="flex items-center justify-between">
                        <span>{row.category}</span>
                        <span>{formatMoney(row.amountCents, { compact: true })}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Upcoming Bills</div>
                  <div className="space-y-1 text-sm">
                    {snapshotContent.upcomingBills.length === 0 && (
                      <div style={{ color: "var(--text-secondary)" }}>No upcoming bills found.</div>
                    )}
                    {snapshotContent.upcomingBills.map((bill, index) => (
                      <div key={`${bill.name}-${index}`} className="flex items-center justify-between">
                        <span>{bill.name}</span>
                        <span>{formatDateLabel(bill.expectedDate, { format: "short", relative: false })}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {snapshotContent.anomalies.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Watchouts</div>
                    <div className="space-y-1 text-sm">
                      {snapshotContent.anomalies.map((item, index) => (
                        <div key={`${item.category}-${index}`}>
                          {item.category}: {formatMoney(item.deltaCents, { signMode: "always", compact: true })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {snapshotContent.recentSummaries.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Recent Plan Notes</div>
                    <ul className="space-y-1 text-sm list-disc pl-4">
                      {snapshotContent.recentSummaries.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Financial Coach</CardTitle>
              <CardDescription>Ask for a plan, a budget check, or questions to focus.</CardDescription>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetSession}
                disabled={resetting}
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {resetting ? "Resetting..." : "New Chat"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              ref={chatContainerRef}
              className="rounded-2xl border p-4 space-y-3 min-h-[260px] max-h-[360px] overflow-y-auto"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
            >
              {messages.length === 0 && (
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Start with something like: &quot;Help me cut $200 from food this month.&quot;
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="rounded-xl px-3 py-2 text-sm max-w-[80%]"
                    style={{
                      backgroundColor: message.role === "user" ? "var(--surface)" : "var(--surface-subtle)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>

            {actions.length > 0 && (
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Suggested Actions</div>
                <ul className="mt-2 space-y-1 text-sm list-disc pl-4">
                  {actions.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {followUps.length > 0 && (
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Follow-up Questions</div>
                <ul className="mt-2 space-y-1 text-sm list-disc pl-4">
                  {followUps.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {profileUpdate && (
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Suggested Profile Updates
                </div>
                <ul className="mt-2 space-y-1 text-sm list-disc pl-4">
                  {formatProfileUpdate(profileUpdate).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleApplyProfile} disabled={applyingProfile}>
                    {applyingProfile ? "Saving..." : "Apply Updates"}
                  </Button>
                </div>
              </div>
            )}

            {foundationUpdate && (
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Suggested Foundation Updates
                </div>
                <ul className="mt-2 space-y-1 text-sm list-disc pl-4">
                  {formatFoundationUpdate(foundationUpdate).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleApplyFoundation} disabled={applyingFoundation}>
                    {applyingFoundation ? "Saving..." : "Apply Foundation Updates"}
                  </Button>
                </div>
              </div>
            )}

            {drilldownRequest && (
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                <div className="text-xs uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                  Transaction Drilldown Request
                </div>
                <div className="mt-2 text-sm" style={{ color: "var(--text)" }}>
                  {drilldownRequest.reason}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleEnableDrilldown} disabled={enablingDrilldown}>
                    {enablingDrilldown ? "Enabling..." : `Share last ${drilldownRequest.windowDays} days`}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Textarea
                placeholder="Ask your coach..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
              />
              <div className="flex items-center justify-between">
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Enter to send - Shift+Enter for new line
                </div>
                <Button onClick={handleSend} disabled={sending || input.trim().length === 0}>
                  {sending ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
