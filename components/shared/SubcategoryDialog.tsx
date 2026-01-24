"use client";

import React from "react";
import * as Lucide from "lucide-react";

interface Category {
  _id: string;
  name: string;
  slug?: string;
  parentId?: string | null;
  categoryType: "expense" | "income" | "transfer";
}

interface SubcategoryDialogProps {
  open: boolean;
  onClose: () => void;
  parentCategory: { id: string; name: string; type: "expense" | "income" } | null;
  subcategories: Category[];
}

export default function SubcategoryDialog({
  open,
  onClose,
  parentCategory,
  subcategories,
}: SubcategoryDialogProps) {
  if (!open || !parentCategory) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md max-h-[80vh] rounded-xl shadow-xl flex flex-col"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Lucide.Layers className="h-5 w-5" style={{ color: "var(--primary)" }} />
            <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              {parentCategory.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <Lucide.X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {subcategories.length === 0 ? (
            <div className="text-center py-8">
              <Lucide.FolderOpen
                className="h-12 w-12 mx-auto mb-3"
                style={{ color: "var(--text-tertiary)" }}
              />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No subcategories for this category
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                Subcategories will appear here when imported from Plaid or added manually
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
                {subcategories.length} subcategorie{subcategories.length === 1 ? "" : "s"}
              </p>
              {subcategories.map((sub) => (
                <div
                  key={sub._id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg"
                  style={{ backgroundColor: "var(--surface-subtle)" }}
                >
                  <Lucide.Tag className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-sm" style={{ color: "var(--text)" }}>
                    {sub.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--surface-subtle)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
