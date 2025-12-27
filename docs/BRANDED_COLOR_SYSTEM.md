# TallyUp Branded Color System

## Design Principle
**"Cards carry truth. Background carries emotion. Accents carry meaning."**

This color system is inspired by the coastal painting: sand, water, and clay tones that create a grounded, calm, human environment for financial tracking.

## What Changed vs What Stayed

### ✅ Unchanged (UI System Preserved)
- Card color: White (#FFFFFF)
- Card radius, elevation, spacing
- Input styling and typography
- **Green = Income/Positive** (#10B981)
- **Red = Expense/Negative** (contextual)

### 🎨 Changed (Environment Layer)
- App background: Sand gradient with subtle water tones
- Primary accent: Purple → Deep Blue-Teal (light) / Seafoam (dark)
- Atmospheric depth from painting zones

---

## Color Zones from Painting

### 🏖️ Sand Zone (Primary Background)
**Emotion**: Grounded, safe, human, non-clinical

```css
--bg-sand-light: #F1E6D6
--bg-sand-mid:   #E4D2BA
--bg-sand-dark:  #D6C1A4
```

**Usage**: 
- Default screen background behind cards
- Subtle radial gradient: `radial-gradient(ellipse at top, rgba(143, 182, 190, 0.08) 0%, #F1E6D6 30%, #E4D2BA 100%)`
- No texture, no noise, just color

### 💧 Water Zone (Clarity Layer)
**Emotion**: Clarity, perspective, calm

```css
--bg-water-soft: #8FB6BE
--bg-water-deep: #6F9EA8
```

**Usage**:
- Subtle gradient fade near top of screens (8% opacity)
- Header background bleed
- NOT a solid block
- Creates atmospheric depth

### 🏺 Clay/Rust Zone (Emotional Memory)
**Emotion**: Atmospheric, emotional, rare

```css
--bg-clay-soft:  #C87A5A
--bg-clay-muted: #B56A52
```

**Usage** (5-12% opacity max):
- Empty states only
- Large section transitions
- Onboarding screens
- Home screen atmosphere

**Never use for**:
- Cards
- Text
- Inputs
- Buttons

---

## Accent Color System

### Light Mode
**Background**: Sand gradient  
**Cards**: White  
**Primary Accent**: Deep Blue-Teal

```css
--accent:       #2F6F85  /* Save buttons, FAB, focus states */
--accent-hover: #255C6F  /* Hover state */
```

**Why**: Provides contrast, anchors seriousness, feels trustworthy on light backgrounds.

### Dark Mode
**Background**: Dark mineral/clay blend  
**Cards**: Charcoal (#8181B1)  
**Primary Accent**: Seafoam

```css
--accent:       #7FD1C2  /* Save buttons, FAB, focus states */
--accent-hover: #6BBFAF  /* Hover state */
```

**Why**: Seafoam glows without aggression, preserves calm, deep blue-teal would feel heavy.

---

## Semantic Colors (Unchanged)

These are truth indicators, not aesthetic choices:

```css
/* Income / Positive */
--success: #10B981
--income:  #10B981

/* Expense / Negative */
--danger:  #DC2626
--expense: #6B7280 (in neutral contexts)
```

**Do NOT soften** these colors or you lose clarity.

---

## Implementation Guide

### Where Accent Color Appears
- ✅ **Save Entry** button
- ✅ **Log FAB** (floating action button)
- ✅ **Selected states** in navigation
- ✅ **Primary CTAs** (call-to-action buttons)
- ✅ **Focus rings** on inputs

### Where It Doesn't Appear
- ❌ Card backgrounds (always white/charcoal)
- ❌ Text (except links)
- ❌ Borders (stay neutral gray)
- ❌ Income/expense indicators (use semantic colors)

### Chart Colors
Ordered by priority:

```css
--chart-1: #2F6F85  /* Primary - Deep Blue-Teal */
--chart-2: #10B981  /* Income Green */
--chart-3: #F59E0B  /* Warning Orange */
--chart-4: #6F9EA8  /* Secondary - Water Deep */
--chart-5: #EC4899  /* Accent Pink */
--chart-6: #C87A5A  /* Clay Soft */
```

---

## CSS Variables Reference

```css
/* Light Mode */
:root {
  /* Background */
  --bg: radial-gradient(ellipse at top, rgba(143, 182, 190, 0.08) 0%, #F1E6D6 30%, #E4D2BA 100%);
  --canvas: #F1E6D6;
  
  /* Surfaces */
  --surface: #FFFFFF;
  
  /* Accent */
  --accent: #2F6F85;
  --accent-hover: #255C6F;
  
  /* Semantic */
  --success: #10B981;
  --danger: #DC2626;
}

/* Dark Mode */
.dark {
  /* Background */
  --bg: radial-gradient(ellipse at top, rgba(111, 158, 168, 0.12) 0%, #1A1612 30%, #0F0D0B 100%);
  --canvas: #0F0D0B;
  
  /* Surfaces */
  --surface: #18181B;
  
  /* Accent */
  --accent: #7FD1C2;
  --accent-hover: #6BBFAF;
  
  /* Semantic */
  --success: #10B981;
  --danger: #EF4444;
}
```

---

## PWA Integration

### Manifest Theme
```json
{
  "theme_color": "#2F6F85",
  "background_color": "#F1E6D6"
}
```

### Icon Gradient
Water → Deep Blue-Teal → Sand:
```svg
<linearGradient id="gradient">
  <stop offset="0%" style="stop-color:#8FB6BE" />
  <stop offset="50%" style="stop-color:#2F6F85" />
  <stop offset="100%" style="stop-color:#D6C1A4" />
</linearGradient>
```

---

## Emotional Impact

### Before (Purple System)
- Screen says: "Log an entry efficiently"
- Feels like: A tool

### After (Painting System)
- Screen says: "You're grounded. Take your time. This is safe to look at."
- Feels like: A place

**This matters deeply** given the product's origin story and focus on awareness over optimization.

---

## Design Philosophy

> TallyUp uses calming, grounded surfaces to reduce anxiety, keep peripherals supportive but not distracting, and make cards and accents work for extraction without friction.

The painting's sand, water, and clay zones create:
- **Grounded safety** (sand)
- **Clarity and perspective** (water)
- **Emotional memory** (clay - used sparingly)

Together, they transform TallyUp from a financial tool into a calm, human space for truth-tracking.

---

## Testing

After implementation:
1. Open app in light mode → Should feel warm, grounded, calm
2. Toggle to dark mode → Should feel mineral, deep, serene
3. Check FAB color → Deep blue-teal (light) or seafoam (dark)
4. Verify cards stay white (light) or charcoal (dark)
5. Confirm green/red semantic colors unchanged

**Success criteria**: Environment changes, UI system preserved, emotional tone shifts from "tool" to "place".
