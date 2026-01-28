"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Lucide from "lucide-react";

// UI Components
import Card, { CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";

/**
 * CoachSettingsPage - Coaching preferences
 * 
 * Configure coach personality, notifications, and data usage.
 */

type CoachStyle = "supportive" | "direct" | "analytical";
type CommunicationFrequency = "daily" | "weekly" | "major-only";
type MemoryDuration = "3mo" | "6mo" | "1yr" | "unlimited";

interface SettingSection {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingSection({ title, description, children }: SettingSection) {
  return (
    <div className="space-y-3">
      <div>
        <h3
          style={{
            fontSize: "var(--text-body)",
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              fontSize: "var(--text-micro)",
              color: "var(--text-secondary)",
              marginTop: 2,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div
      className="flex items-center justify-between py-3 border-b last:border-0"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex-1 min-w-0 pr-4">
        <p style={{ fontSize: "var(--text-meta)", color: "var(--text)" }}>
          {label}
        </p>
        {description && (
          <p style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
            {description}
          </p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="shrink-0 relative w-11 h-6 rounded-full transition-colors"
        style={{
          backgroundColor: checked ? "var(--primary)" : "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
        role="switch"
        aria-checked={checked}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform"
          style={{
            backgroundColor: "#FFFFFF",
            transform: checked ? "translateX(20px)" : "translateX(0)",
            boxShadow: "var(--shadow-sm)",
          }}
        />
      </button>
    </div>
  );
}

export default function CoachSettingsPage() {
  const router = useRouter();

  // Settings state
  const [coachStyle, setCoachStyle] = useState<CoachStyle>("supportive");
  const [frequency, setFrequency] = useState<CommunicationFrequency>("weekly");
  const [celebrationLevel, setCelebrationLevel] = useState(70); // 0-100
  const [memoryDuration, setMemoryDuration] = useState<MemoryDuration>("6mo");

  // Focus areas (draggable order)
  const [focusAreas, setFocusAreas] = useState([
    { id: "emergency", label: "Emergency fund" },
    { id: "debt", label: "High-interest debt" },
    { id: "retirement", label: "Retirement savings" },
    { id: "goals", label: "Other goals" },
  ]);

  // Notification preferences
  const [notifications, setNotifications] = useState({
    spendingAnomalies: true,
    optimizations: true,
    celebrations: true,
    educational: false,
  });

  // Data usage preferences
  const [dataUsage, setDataUsage] = useState({
    analyzeSpending: true,
    comparePeers: true,
    improveAI: false,
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <PageHeader
        title="Coach Settings"
        subtitle="Personalize your coaching experience"
        rightSlot={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/coach")}
          >
            <Lucide.ChevronLeft style={{ width: 16, height: 16 }} />
            <span className="ml-1">Back</span>
          </Button>
        }
      />

      {/* Coach Personality */}
      <Card>
        <CardContent>
          <SettingSection title="Coach Personality">
            <div className="space-y-3">
              {/* Style selection */}
              <div>
                <label
                  className="block mb-2"
                  style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)" }}
                >
                  Communication Style
                </label>
                <div className="flex gap-2">
                  {[
                    { key: "supportive" as CoachStyle, label: "Supportive", icon: Lucide.Heart },
                    { key: "direct" as CoachStyle, label: "Direct", icon: Lucide.Target },
                    { key: "analytical" as CoachStyle, label: "Analytical", icon: Lucide.BarChart3 },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setCoachStyle(key)}
                      className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-colors"
                      style={{
                        backgroundColor: coachStyle === key ? "var(--primary)" : "var(--surface-2)",
                        color: coachStyle === key ? "#FFFFFF" : "var(--text)",
                        border: `1px solid ${coachStyle === key ? "var(--primary)" : "var(--border)"}`,
                      }}
                    >
                      <Icon style={{ width: 20, height: 20 }} />
                      <span style={{ fontSize: "var(--text-micro)", fontWeight: 500 }}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label
                  className="block mb-2"
                  style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)" }}
                >
                  Communication Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as CommunicationFrequency)}
                  className="w-full px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: "var(--text-meta)",
                  }}
                >
                  <option value="daily">Daily insights</option>
                  <option value="weekly">Weekly summaries</option>
                  <option value="major-only">Major events only</option>
                </select>
              </div>

              {/* Celebration slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    style={{ fontSize: "var(--text-meta)", color: "var(--text-secondary)" }}
                  >
                    Celebration Level
                  </label>
                  <span
                    style={{ fontSize: "var(--text-micro)", color: "var(--text)" }}
                  >
                    {celebrationLevel < 30 ? "Low" : celebrationLevel < 70 ? "Medium" : "High"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={celebrationLevel}
                  onChange={(e) => setCelebrationLevel(Number(e.target.value))}
                  className="w-full"
                  style={{
                    accentColor: "var(--primary)",
                  }}
                />
              </div>
            </div>
          </SettingSection>
        </CardContent>
      </Card>

      {/* Focus Areas */}
      <Card>
        <CardContent>
          <SettingSection
            title="Coaching Focus Areas"
            description="Drag to reorder priorities"
          >
            <div className="space-y-2">
              {focusAreas.map((area, index) => (
                <div
                  key={area.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Lucide.GripVertical
                    style={{ width: 18, height: 18, color: "var(--text-secondary)" }}
                  />
                  <span
                    className="flex-1"
                    style={{ fontSize: "var(--text-meta)", color: "var(--text)" }}
                  >
                    {index + 1}. {area.label}
                  </span>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setFocusAreas([
                  { id: "emergency", label: "Emergency fund" },
                  { id: "debt", label: "High-interest debt" },
                  { id: "retirement", label: "Retirement savings" },
                  { id: "goals", label: "Other goals" },
                ]);
              }}
            >
              Reset to default
            </Button>
          </SettingSection>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardContent>
          <SettingSection title="Notification Preferences">
            <div>
              <ToggleRow
                label="Spending anomalies"
                description="Alert when spending patterns change"
                checked={notifications.spendingAnomalies}
                onChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, spendingAnomalies: checked }))
                }
              />
              <ToggleRow
                label="Optimization opportunities"
                description="Tips to save money"
                checked={notifications.optimizations}
                onChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, optimizations: checked }))
                }
              />
              <ToggleRow
                label="Progress celebrations"
                description="Celebrate your wins"
                checked={notifications.celebrations}
                onChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, celebrations: checked }))
                }
              />
              <ToggleRow
                label="Educational content"
                description="Learning tips and articles"
                checked={notifications.educational}
                onChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, educational: checked }))
                }
              />
            </div>
          </SettingSection>
        </CardContent>
      </Card>

      {/* Data Usage & Privacy */}
      <Card>
        <CardContent>
          <SettingSection
            title="Data Usage & Privacy"
            description="Coach analyzes patterns to provide insights"
          >
            <div>
              <ToggleRow
                label="Analyze spending patterns"
                checked={dataUsage.analyzeSpending}
                onChange={(checked) =>
                  setDataUsage((prev) => ({ ...prev, analyzeSpending: checked }))
                }
              />
              <ToggleRow
                label="Compare to anonymized peers"
                description="See how you stack up"
                checked={dataUsage.comparePeers}
                onChange={(checked) =>
                  setDataUsage((prev) => ({ ...prev, comparePeers: checked }))
                }
              />
              <ToggleRow
                label="Help improve AI (anonymous)"
                checked={dataUsage.improveAI}
                onChange={(checked) =>
                  setDataUsage((prev) => ({ ...prev, improveAI: checked }))
                }
              />
            </div>

            {/* Memory duration */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontSize: "var(--text-meta)", color: "var(--text)" }}>
                    Conversation memory
                  </p>
                  <p style={{ fontSize: "var(--text-micro)", color: "var(--text-secondary)" }}>
                    How long coach remembers past chats
                  </p>
                </div>
                <select
                  value={memoryDuration}
                  onChange={(e) => setMemoryDuration(e.target.value as MemoryDuration)}
                  className="px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: "var(--text-meta)",
                  }}
                >
                  <option value="3mo">3 months</option>
                  <option value="6mo">6 months</option>
                  <option value="1yr">1 year</option>
                  <option value="unlimited">Unlimited</option>
                </select>
              </div>
            </div>
          </SettingSection>
        </CardContent>
      </Card>

      {/* History & Export */}
      <Card>
        <CardContent>
          <SettingSection title="Coaching History & Export">
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                leftIcon={<Lucide.Lightbulb style={{ width: 18, height: 18 }} />}
                onClick={() => router.push("/coach/insights")}
              >
                View All Insights
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                leftIcon={<Lucide.Download style={{ width: 18, height: 18 }} />}
                onClick={() => {
                  // Export functionality
                  console.log("Export conversations");
                }}
              >
                Export All Conversations
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                leftIcon={<Lucide.Trash2 style={{ width: 18, height: 18, color: "var(--danger)" }} />}
                onClick={() => {
                  // Reset functionality
                  console.log("Reset progress");
                }}
                style={{ color: "var(--danger)" }}
              >
                Reset Coaching Progress
              </Button>
            </div>
          </SettingSection>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="sticky bottom-4">
        <Button className="w-full" size="lg">
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
