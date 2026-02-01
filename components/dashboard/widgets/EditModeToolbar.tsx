"use client";

import * as Lucide from "lucide-react";
import { hapticToggle } from "./haptics";

interface EditModeToolbarProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onOpenWidgetPanel: () => void;
  hasChanges?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function EditModeToolbar({
  isEditMode,
  onToggleEditMode,
  onOpenWidgetPanel,
  hasChanges,
  onSave,
  onCancel,
  isSaving,
}: EditModeToolbarProps) {
  const handleToggle = () => {
    hapticToggle();
    onToggleEditMode();
  };

  const handleOpenPanel = () => {
    hapticToggle();
    onOpenWidgetPanel();
  };

  const handleSave = () => {
    hapticToggle();
    onSave?.();
  };

  const handleCancel = () => {
    hapticToggle();
    onCancel?.();
  };

  if (!isEditMode) {
    // Collapsed state - just show edit button
    return (
      <button
        onClick={handleToggle}
        className="p-2 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
        style={{ color: "var(--text-secondary)" }}
        title="Customize dashboard"
        aria-label="Customize dashboard"
      >
        <Lucide.Settings2 className="h-5 w-5" />
      </button>
    );
  }

  // Expanded edit mode toolbar
  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ 
        backgroundColor: "var(--accent-subtle)",
        border: "1px solid var(--accent)",
      }}
    >
      <span 
        className="text-sm font-medium mr-1"
        style={{ color: "var(--accent)" }}
      >
        Editing
      </span>
      
      {/* Add/manage widgets */}
      <button
        onClick={handleOpenPanel}
        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface)]"
        title="Add or remove widgets"
        aria-label="Add or remove widgets"
      >
        <Lucide.LayoutGrid 
          className="h-4 w-4" 
          style={{ color: "var(--accent)" }} 
        />
      </button>
      
      <div 
        className="w-px h-5 mx-1"
        style={{ backgroundColor: "var(--accent)" }}
      />
      
      {/* Cancel */}
      <button
        onClick={handleCancel}
        className="px-2.5 py-1 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--surface)]"
        style={{ color: "var(--text-secondary)" }}
        disabled={isSaving}
      >
        Cancel
      </button>
      
      {/* Save / Done */}
      <button
        onClick={hasChanges ? handleSave : handleToggle}
        disabled={isSaving}
        className="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
        style={{ 
          backgroundColor: hasChanges ? "var(--accent)" : "var(--surface)",
          color: hasChanges ? "white" : "var(--text)",
        }}
      >
        {isSaving ? (
          <Lucide.Loader2 className="h-4 w-4 animate-spin" />
        ) : hasChanges ? (
          "Save"
        ) : (
          "Done"
        )}
      </button>
    </div>
  );
}
