"use client";

type UpcomingPreset = "7d" | "30d" | "60d" | "90d";

export default function RecurringRangeBar({
  upcomingPreset,
  onChangeUpcomingPreset,
}: {
  upcomingPreset: UpcomingPreset;
  onChangeUpcomingPreset: (preset: UpcomingPreset) => void;
}) {
  const presets: UpcomingPreset[] = ["7d", "30d", "60d", "90d"];
  return (
    <div className="flex items-center justify-between rounded-xl p-2" style={{ backgroundColor: "var(--surface-2)" }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
          Upcoming range
        </span>
        <div className="flex gap-1">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => onChangeUpcomingPreset(p)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{
                backgroundColor: upcomingPreset === p ? "var(--surface)" : "transparent",
                color: upcomingPreset === p ? "var(--text)" : "var(--text-secondary)",
                border: `1px solid ${upcomingPreset === p ? "var(--border)" : "transparent"}`,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        Recurring runs alongside manual logging
      </div>
    </div>
  );
}
