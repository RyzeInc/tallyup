"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import * as Lucide from "lucide-react";
import { useState, useEffect } from "react";
import { NetIncomeCalendar } from "@/components/calendar/NetIncomeCalendar";
import { RecurringCalendar } from "@/components/calendar/RecurringCalendar";

type CalendarTab = "net-income" | "recurring";

export default function CalendarPage() {
  const [activeTab, setActiveTab] = useState<CalendarTab>("net-income");
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const tabs = [
    { id: "net-income" as const, label: "Net Income", icon: Lucide.DollarSign },
    { id: "recurring" as const, label: "Recurring", icon: Lucide.RefreshCw },
  ];

  return (
    <div 
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: "var(--space-4, 16px)",
        // On desktop, break out of the narrow content container to use full width
        ...(isDesktop && {
          marginLeft: "calc(-1 * (50vw - 50%))",
          marginRight: "calc(-1 * (50vw - 50%))",
          paddingLeft: "max(24px, calc(50vw - 720px))",
          paddingRight: "max(24px, calc(50vw - 720px))",
          width: "100vw",
        }),
      }}
    >
      {/* Page Header */}
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "var(--space-2, 8px)",
        }}
      >
        <Lucide.Calendar className="h-6 w-6" style={{ color: "var(--primary)" }} />
        <h1 
          style={{ 
            fontSize: "var(--text-h1, 1.5rem)", 
            fontWeight: 600, 
            color: "var(--text)",
          }}
        >
          Calendar
        </h1>
      </div>

      <SignedOut>
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "var(--card-radius, 12px)",
            border: "1px solid var(--border)",
            padding: "var(--space-6, 24px)",
            textAlign: "center",
          }}
        >
          <Lucide.Lock className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--text-tertiary)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            Sign in to view your calendar
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
            Track your net income over time and see your recurring transactions at a glance.
          </p>
          <SignInButton mode="modal">
            <button
              style={{
                padding: "12px 24px",
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
                borderRadius: "var(--radius-md, 8px)",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Tab Selector */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-2, 8px)",
            padding: "4px",
            backgroundColor: "var(--surface)",
            borderRadius: "var(--radius-md, 12px)",
            border: "1px solid var(--border)",
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "10px 16px",
                  borderRadius: "var(--radius-sm, 8px)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 600 : 500,
                  backgroundColor: isActive ? "var(--primary)" : "transparent",
                  color: isActive ? "var(--primary-foreground)" : "var(--text-secondary)",
                  transition: "all 150ms ease",
                }}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Calendar Content */}
        <div>
          {activeTab === "net-income" && (
            <div>
              <p 
                style={{ 
                  fontSize: "0.8125rem", 
                  color: "var(--text-secondary)", 
                  marginBottom: "var(--space-3, 12px)",
                }}
              >
                View your monthly income vs expenses across any year.
              </p>
              <NetIncomeCalendar />
            </div>
          )}

          {activeTab === "recurring" && (
            <div style={{ 
              display: "flex", 
              flexDirection: "column",
              height: isDesktop ? "calc(100vh - 280px)" : "auto",
              minHeight: isDesktop ? 400 : undefined,
            }}>
              <p 
                style={{ 
                  fontSize: "0.8125rem", 
                  color: "var(--text-secondary)", 
                  marginBottom: "var(--space-3, 12px)",
                  flexShrink: 0,
                }}
              >
                See when your recurring transactions are expected each month.
              </p>
              <div style={{ flex: 1, minHeight: 0 }}>
                <RecurringCalendar />
              </div>
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
}
