"use client";

import { useState } from "react";
import * as Lucide from "lucide-react";
import { WidgetId, WidgetPlacement, WIDGET_REGISTRY } from "./types";
import { hapticToggle } from "./haptics";

interface WidgetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: WidgetPlacement[];
  onToggleWidget: (widgetId: WidgetId, visible: boolean) => void;
  onResetLayout: () => void;
}

type CategoryFilter = "all" | "overview" | "budgeting" | "tracking" | "actions";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "All",
  overview: "Overview",
  budgeting: "Budgeting",
  tracking: "Tracking",
  actions: "Actions",
};

// Map icon names to components
const ICON_MAP: Record<string, typeof Lucide.Activity> = {
  TrendingUp: Lucide.TrendingUp,
  Shield: Lucide.Shield,
  Calendar: Lucide.Calendar,
  PieChart: Lucide.PieChart,
  Target: Lucide.Target,
  Landmark: Lucide.Landmark,
  Receipt: Lucide.Receipt,
  Clock: Lucide.Clock,
  BarChart3: Lucide.BarChart3,
  AlertCircle: Lucide.AlertCircle,
  Activity: Lucide.Activity,
  Zap: Lucide.Zap,
  // New widget icons
  MessageCircle: Lucide.MessageCircle,
  Sparkles: Lucide.Sparkles,
  TrendingDown: Lucide.TrendingDown,
  ArrowUpDown: Lucide.ArrowUpDown,
  CalendarDays: Lucide.CalendarDays,
  Wallet: Lucide.Wallet,
  CalendarRange: Lucide.CalendarRange,
};

export function WidgetPanel({
  isOpen,
  onClose,
  widgets,
  onToggleWidget,
  onResetLayout,
}: WidgetPanelProps) {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  if (!isOpen) return null;

  const widgetList = Object.values(WIDGET_REGISTRY).filter(
    (config) => filter === "all" || config.category === filter
  );

  const handleToggle = (widgetId: WidgetId) => {
    const widget = widgets.find((w) => w.widgetId === widgetId);
    const isCurrentlyVisible = widget?.visible ?? true;
    hapticToggle();
    onToggleWidget(widgetId, !isCurrentlyVisible);
  };

  const handleReset = () => {
    hapticToggle();
    onResetLayout();
    setShowConfirmReset(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl max-h-[70vh] overflow-hidden flex flex-col"
        style={{ 
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <h3 
            className="text-h3 font-semibold"
            style={{ color: "var(--text)" }}
          >
            Customize Dashboard
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
        
        {/* Category filter */}
        <div className="px-4 py-2 border-b overflow-x-auto shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-2">
            {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === cat
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-subtle)]"
                }`}
                style={{
                  color: filter === cat ? "white" : "var(--text-secondary)",
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
        
        {/* Widget list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {widgetList.map((config) => {
            const widget = widgets.find((w) => w.widgetId === config.id);
            const isVisible = widget?.visible ?? true;
            const IconComponent = ICON_MAP[config.icon] || Lucide.Box;
            
            return (
              <button
                key={config.id}
                onClick={() => handleToggle(config.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors"
                style={{
                  backgroundColor: isVisible ? "var(--surface-subtle)" : "transparent",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isVisible ? "var(--accent-subtle)" : "var(--surface-subtle)",
                  }}
                >
                  <IconComponent
                    className="h-5 w-5"
                    style={{ color: isVisible ? "var(--accent)" : "var(--text-tertiary)" }}
                  />
                </div>
                
                <div className="flex-1 text-left min-w-0">
                  <div 
                    className="font-medium truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {config.name}
                  </div>
                  <div 
                    className="text-sm truncate"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {config.description}
                  </div>
                </div>
                
                <div
                  className={`w-12 h-7 rounded-full p-1 transition-colors ${
                    isVisible ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isVisible ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Footer with reset button */}
        <div 
          className="px-4 py-3 border-t shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          {showConfirmReset ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Reset to default layout?
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ 
                    backgroundColor: "var(--surface-subtle)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ 
                    backgroundColor: "var(--danger)",
                    color: "white",
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmReset(true)}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--surface-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              Reset to Default Layout
            </button>
          )}
        </div>
      </div>
    </>
  );
}
