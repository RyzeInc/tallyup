"use client";

import { useCallback, useRef, useState, useEffect, ReactNode } from "react";
import * as Lucide from "lucide-react";
import { hapticDragStart, hapticDragMove, hapticDrop, hapticResize, hapticToggle } from "./haptics";
import { WidgetId, WidgetSize, WIDGET_REGISTRY, getGridSpan } from "./types";

interface WidgetWrapperProps {
  widgetId: WidgetId;
  size: WidgetSize;
  visible: boolean;
  isEditMode: boolean;
  children: ReactNode;
  onReorder?: (dragIndex: number, dropIndex: number) => void;
  onResize?: (widgetId: WidgetId, size: WidgetSize) => void;
  onToggleVisibility?: (widgetId: WidgetId, visible: boolean) => void;
  index: number;
  dragState?: {
    isDragging: boolean;
    dragIndex: number | null;
    dropIndex: number | null;
  };
  onDragStart?: (index: number) => void;
  onDragEnter?: (index: number) => void;
  onDragEnd?: () => void;
}

const LONG_PRESS_DURATION = 500; // ms for haptic touch trigger

export function WidgetWrapper({
  widgetId,
  size,
  visible,
  isEditMode,
  children,
  onResize,
  onToggleVisibility,
  index,
  dragState,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: WidgetWrapperProps) {
  const config = WIDGET_REGISTRY[widgetId];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const isDragTarget = dragState?.dropIndex === index && dragState?.dragIndex !== index;
  const isBeingDragged = dragState?.isDragging && dragState?.dragIndex === index;

  // Handle long press for touch devices
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isEditMode) return;
    
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    
    longPressTimer.current = setTimeout(() => {
      hapticDragStart();
      setIsTouchDragging(true);
      onDragStart?.(index);
    }, LONG_PRESS_DURATION);
  }, [isEditMode, index, onDragStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isEditMode) return;
    
    const touch = e.touches[0];
    
    // Cancel long press if moved too far
    if (touchStartPos.current && longPressTimer.current) {
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    
    // Handle drag move
    if (isTouchDragging) {
      e.preventDefault();
      hapticDragMove();
      
      // Find the element under the touch point
      const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
      const targetWidget = elements.find(el => el.hasAttribute('data-widget-index'));
      if (targetWidget) {
        const targetIndex = parseInt(targetWidget.getAttribute('data-widget-index') || '0', 10);
        if (targetIndex !== dragState?.dropIndex) {
          onDragEnter?.(targetIndex);
        }
      }
    }
  }, [isEditMode, isTouchDragging, dragState?.dropIndex, onDragEnter]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    if (isTouchDragging) {
      hapticDrop();
      setIsTouchDragging(false);
      onDragEnd?.();
    }
    
    touchStartPos.current = null;
  }, [isTouchDragging, onDragEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Desktop drag handlers
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!isEditMode) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    hapticDragStart();
    onDragStart?.(index);
  }, [isEditMode, index, onDragStart]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [isEditMode]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    if (dragState?.dragIndex !== index) {
      hapticDragMove();
      onDragEnter?.(index);
    }
  }, [isEditMode, index, dragState?.dragIndex, onDragEnter]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    hapticDrop();
    onDragEnd?.();
  }, [isEditMode, onDragEnd]);

  const handleDragEnd = useCallback(() => {
    onDragEnd?.();
  }, [onDragEnd]);

  // Size cycle handler
  const handleCycleSize = useCallback(() => {
    if (!config) return;
    const currentIdx = config.allowedSizes.indexOf(size);
    const nextIdx = (currentIdx + 1) % config.allowedSizes.length;
    hapticResize();
    onResize?.(widgetId, config.allowedSizes[nextIdx]);
  }, [config, size, widgetId, onResize]);

  // Visibility toggle handler
  const handleToggleVisibility = useCallback(() => {
    hapticToggle();
    onToggleVisibility?.(widgetId, !visible);
  }, [widgetId, visible, onToggleVisibility]);

  // Don't render hidden widgets when not in edit mode
  if (!visible && !isEditMode) {
    return null;
  }

  return (
    <div
      ref={wrapperRef}
      data-widget-index={index}
      draggable={isEditMode}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`
        relative transition-all duration-200
        ${getGridSpan(size)}
        ${isEditMode ? "cursor-grab active:cursor-grabbing" : ""}
        ${isBeingDragged ? "opacity-50 scale-95" : ""}
        ${isDragTarget ? "ring-2 ring-[var(--accent)] ring-offset-2" : ""}
        ${!visible ? "opacity-40" : ""}
        ${isTouchDragging ? "z-50 scale-105 shadow-xl" : ""}
      `}
      style={{
        touchAction: isEditMode ? "none" : "auto",
      }}
    >
      {/* Edit mode overlay */}
      {isEditMode && (
        <div 
          className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed pointer-events-none"
          style={{ borderColor: "var(--accent)" }}
        />
      )}
      
      {/* Edit mode controls */}
      {isEditMode && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
          {/* Size toggle (only if multiple sizes allowed) */}
          {config && config.allowedSizes.length > 1 && (
            <button
              onClick={handleCycleSize}
              className="p-1.5 rounded-lg transition-colors"
              style={{ 
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
              }}
              title={`Size: ${size} (click to cycle)`}
            >
              <Lucide.Maximize2 
                className="h-4 w-4" 
                style={{ color: "var(--text-secondary)" }} 
              />
            </button>
          )}
          
          {/* Visibility toggle */}
          <button
            onClick={handleToggleVisibility}
            className="p-1.5 rounded-lg transition-colors"
            style={{ 
              backgroundColor: visible ? "var(--surface)" : "var(--danger-subtle)",
              border: "1px solid var(--border)",
            }}
            title={visible ? "Hide widget" : "Show widget"}
          >
            {visible ? (
              <Lucide.Eye 
                className="h-4 w-4" 
                style={{ color: "var(--text-secondary)" }} 
              />
            ) : (
              <Lucide.EyeOff 
                className="h-4 w-4" 
                style={{ color: "var(--danger)" }} 
              />
            )}
          </button>
          
          {/* Drag handle indicator */}
          <div
            className="p-1.5 rounded-lg"
            style={{ 
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
            title="Hold and drag to reorder"
          >
            <Lucide.GripVertical 
              className="h-4 w-4" 
              style={{ color: "var(--text-tertiary)" }} 
            />
          </div>
        </div>
      )}
      
      {/* Widget content */}
      <div className={isEditMode ? "pointer-events-none" : ""}>
        {children}
      </div>
      
      {/* Hidden widget label */}
      {isEditMode && !visible && config && (
        <div 
          className="absolute inset-0 flex items-center justify-center z-10 rounded-2xl"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
        >
          <span 
            className="text-sm font-medium px-3 py-1.5 rounded-lg"
            style={{ 
              backgroundColor: "var(--surface)",
              color: "var(--text-secondary)",
            }}
          >
            {config.name} (Hidden)
          </span>
        </div>
      )}
    </div>
  );
}
