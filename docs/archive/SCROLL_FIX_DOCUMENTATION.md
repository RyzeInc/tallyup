# ActivityTable Scroll Container Fix

## Problem Statement
The ActivityTable was not scrolling internally. When `html/body` had `overflow: hidden`, the entire viewport became frozen with no way to scroll through transaction rows. The rounded corners were also not displaying properly.

## Root Causes

### 1. **Incorrect Container Hierarchy**
The Results section in `activity/page.tsx` had `overflow: auto`, trying to be the scroll container, but it was wrapping a nested `flex: 1 min-h-0` div that also had no `overflow` defined. This created an ambiguous scroll target.

### 2. **Missing Height Constraints in Chain**
The flex chain needs every ancestor to have either:
- A defined height, OR
- `flex: 1 min-h-0` (for flex children that need to shrink)

Without `min-h-0`, flex children refuse to shrink below their content height.

### 3. **Rounding Applied to Wrong Element**
Border-radius styling was being applied to the same element that had `overflow: hidden`, which was hiding the rounded corners behind child backgrounds.

## Solution Implemented

### Changes to `/components/activity/ActivityTable.tsx`

**Before (broken structure):**
```tsx
<div className="rounded-xl flex flex-col" style={{ flex: 1, minHeight: 0 }}>
  {/* header */}
  <div className="flex-1 min-h-0 overflow-hidden">
    <div className="h-full overflow-auto">
      {/* entries.map() */}
    </div>
  </div>
</div>
```

**After (fixed structure):**
```tsx
<div className="flex flex-col min-h-0 rounded-xl" style={{ overflow: "hidden" }}>
  {/* header: flexShrink: 0, sticky top-0 z-10 */}
  
  {/* LAYER 2: actual scroll container */}
  <div className="flex-1 min-h-0 h-full overflow-auto">
    {entries.map(...)}
  </div>
</div>
```

**Key changes:**
1. **Outer card layer**: `flex flex-col min-h-0 rounded-xl` with `overflow: hidden` in inline style
   - This element owns the rounded corners visually
   - It clips all children via overflow-hidden
   - It has constrained height via `flex: 1 min-h-0` from parent
   
2. **Scroll container**: `flex-1 min-h-0 h-full overflow-auto`
   - `flex-1` makes it expand to fill available space
   - `min-h-0` allows it to shrink below content height
   - `h-full` ensures it fills its parent height
   - `overflow-auto` enables scrolling when scrollHeight > clientHeight

### Changes to `/app/(app)/activity/page.tsx`

**Before:**
```tsx
<div style={{ ..., flex: 1, minHeight: 0, overflow: "auto", ... }}>
  {/* ActivityTable inside */}
</div>
```

**After:**
```tsx
<div style={{ ..., flex: 1, minHeight: 0, overflow: "hidden", ... }}>
  {/* ActivityTable inside */}
</div>
```

**Why:** The Results container should NOT be the scroll target. The ActivityTable has its own internal scroll container. The Results container should use `overflow: hidden` to prevent double-scrolling and let the table handle all scrolling internally.

## Verification Checklist

### DevTools Console Commands to Verify

```javascript
// Find the scroll container (should be the div.overflow-auto inside ActivityTable)
const scrollContainer = document.querySelector('[class*="overflow-auto"]');

// Verify it's height-constrained
console.log({
  scrollHeight: scrollContainer.scrollHeight,
  clientHeight: scrollContainer.clientHeight,
  canScroll: scrollContainer.scrollHeight > scrollContainer.clientHeight,
  computedHeight: getComputedStyle(scrollContainer).height,
  computedOverflow: getComputedStyle(scrollContainer).overflow,
});

// Verify parent is flex with min-h-0
const parent = scrollContainer.parentElement;
console.log({
  parentDisplay: getComputedStyle(parent).display,
  parentFlex: getComputedStyle(parent).flex,
  parentMinHeight: getComputedStyle(parent).minHeight,
});

// Verify outer card has rounded corners and border
const card = scrollContainer.parentElement.parentElement;
console.log({
  cardBorderRadius: getComputedStyle(card).borderRadius,
  cardBackground: getComputedStyle(card).backgroundColor,
  cardBorder: getComputedStyle(card).border,
  cardOverflow: getComputedStyle(card).overflow,
});
```

### Expected Results

1. **Scroll works:**
   - `canScroll === true` when table has many rows
   - Mouse wheel/trackpad scrolls the table rows
   - Header stays fixed at top (sticky positioning)

2. **Rounded corners visible:**
   - All 4 corners of the table show rounded border
   - Bottom corners visible on the beige/background color

3. **No page-level scroll:**
   - `document.body.scrollHeight === document.body.clientHeight`
   - `window.innerHeight` matches viewport
   - No browser scroll bar appears

## Layout Chain (Complete)

```
html/body { height: 100%, overflow: hidden } ← Locks viewport
  ↓
AppShell { h-screen overflow-hidden } ← Page container
  ↓
Page content area { flex: 1 min-h-0 }
  ↓
Activity Page { flex: 1 min-h-0 flex flex-col }
  ↓
Sticky Header { flexShrink: 0 }
Results Container { flex: 1 min-h-0 overflow: hidden } ← NO SCROLL HERE
  ↓
ActivityTable { flex: 1 min-h-0 rounded-xl overflow: hidden }
  ├─ Header row { flexShrink: 0, sticky top-0 }
  └─ Scroll container { flex-1 min-h-0 h-full overflow-auto } ← SCROLLS HERE
       └─ Entry rows mapped
```

## Files Changed

1. `/components/activity/ActivityTable.tsx`
   - Changed outer container from `flex: 1, minHeight: 0` inline styles to Tailwind classes `flex flex-col min-h-0`
   - Moved `overflow: hidden` from removed nested div to inline style on outer card
   - Kept `rounded-xl` as Tailwind class
   - Fixed closing divs (removed extra closing div)

2. `/app/(app)/activity/page.tsx`
   - Changed Results container `overflow: "auto"` to `overflow: "hidden"`
   - This prevents the Results container from being a scroll target

## Why This Works

The key insight is the **2-layer pattern**:

- **Layer 1 (Outer Card):** Handles the visual appearance (rounded corners, border, background color). Uses `overflow: hidden` to clip children and make border-radius visible.

- **Layer 2 (Scroll Container):** Handles scrolling. Has constrained height (`flex: 1 min-h-0 h-full`) and `overflow-auto` to enable scrolling.

These are separate concerns:
- Rounding + clipping happens at Layer 1
- Scrolling happens at Layer 2

By separating them, both work correctly simultaneously.

## Common Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Scroll doesn't work | Missing `min-h-0` in ancestor flex chain | Add `min-h-0` to all `flex: 1` ancestors |
| Rounded corners don't show | `overflow: hidden` on non-rounded element | Move rounding and overflow-hidden to same element (Layer 1) |
| Double-scroll issues | Parent and child both have `overflow: auto` | Only scroll container should have `overflow: auto`, parents use `overflow: hidden` |
| Table extends past viewport | Missing `overflow: hidden` on html/body | Add to globals.css: `html, body { height: 100%; overflow: hidden; }` |
| Page scrolls when it shouldn't | Results container has `overflow: auto` | Change to `overflow: hidden` |

