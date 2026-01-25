# TallyUp Branded Color System

## Design Principle
**"Standing at the shoreline — inspired by the coastal painting"**

This color system is directly derived from the beach painting reference:
- **Deep slate-blue ocean** at the top
- **Bright white foam band** where waves meet shore
- **Vivid burnt orange/terracotta wet sand ridge** (THE KEY IDENTITY!)
- **Warm beige dry sand** with pebbles at the bottom

The **burnt orange terracotta** is the hero color — it's what makes this theme unmistakably "beach."

---

## The Painting Reference

```
┌─────────────────────────────────────┐
│  Deep Slate-Blue Ocean (#4A5968)    │  ← Text color source
│  ─────────────────────────────────  │
│  Ocean Mid (#6A7F8E)                │
│  ─────────────────────────────────  │
│  Ocean Foam (#8BA0AC)               │
├─────────────────────────────────────┤
│  BRIGHT WHITE FOAM (#FAFAF8)        │  ← Card surface
├─────────────────────────────────────┤
│  Coral Pink (#C98A7A)               │
│  ─────────────────────────────────  │
│  ████ BURNT ORANGE (#C4724A) ████   │  ← PRIMARY ACCENT (the hero!)
│  ─────────────────────────────────  │
│  Terracotta Light (#D68B62)         │
├─────────────────────────────────────┤
│  Warm Sand (#E6D5BC)                │
│  ─────────────────────────────────  │
│  Dry Sand/Beige (#F2E4D1)           │  ← Background base
└─────────────────────────────────────┘
```

---

## Core Color Tokens

### Sand System (Backgrounds)

| Token | Hex | Usage |
|-------|-----|-------|
| `--sand-dry` | #F2E4D1 | Main background - warm beige |
| `--sand-warm` | #E6D5BC | Elevated sections - warmer tone |
| `--foam-white` | #FAFAF8 | Card surfaces - bright white |
| `--shell-cream` | #F5EDE0 | Inputs, chips - cream |

### Burnt Orange / Terracotta (THE HERO!)

| Token | Hex | Usage |
|-------|-----|-------|
| `--terracotta` | #C4724A | **Primary accent** - buttons, CTAs, active states |
| `--terracotta-deep` | #A85D3B | Hover states |
| `--terracotta-light` | #D68B62 | Soft accents |
| `--coral-pink` | #C98A7A | Secondary warm tones |

### Ocean System (Text & Contrast)

| Token | Hex | Usage |
|-------|-----|-------|
| `--ocean-deep` | #4A5968 | Primary text color |
| `--ocean-slate` | #5A6A78 | Secondary text |
| `--ocean-mid` | #6A7F8E | Tertiary / subtle UI |
| `--ocean-foam` | #8BA0AC | Borders, dividers |

---

## Background Gradient

The background isn't flat — it has atmosphere from the painting:

```css
--bg-full: 
  /* Ocean atmosphere at top */
  linear-gradient(180deg, 
    rgba(74, 89, 104, 0.08) 0%,
    rgba(106, 127, 142, 0.05) 8%,
    transparent 20%
  ),
  /* Burnt orange warmth in upper-mid */
  radial-gradient(ellipse 140% 35% at 50% 25%, 
    rgba(196, 114, 74, 0.12) 0%, 
    transparent 70%
  ),
  /* Warm sand base */
  linear-gradient(175deg, 
    #F4E8D6 0%,
    #F2E4D1 30%,
    #E6D5BC 60%,
    #F2E4D1 100%
  );
```

---

## Accent Usage

### Burnt Orange (Primary)

The terracotta/burnt orange is used for:
- ✅ Primary buttons and FAB
- ✅ Selected tab states
- ✅ Active chips and badges
- ✅ Focus rings
- ✅ Chart highlights
- ✅ The "hero" interaction on each screen

### Ocean Blue (Secondary/Contrast)

Ocean colors provide contrast:
- ✅ Primary text
- ✅ Unselected states
- ✅ Charts (for variety)
- ✅ Net positive indicators (distinct from income green)

---

## Semantic Colors

| Semantic | Hex | Note |
|----------|-----|------|
| Income (success) | #5A9474 | Green that works with warm palette |
| Expense | Uses `--muted` | Neutral slate |
| Danger | #C45858 | Warm red, distinct from terracotta |
| Warning | #C4944A | Warm amber/gold |

---

## Chart Palette

Derived from the painting's color bands:

```css
--chart-1: var(--terracotta);      /* Burnt orange - primary! */
--chart-2: var(--ocean-mid);       /* Ocean blue */
--chart-3: var(--coral-pink);      /* Coral pink */
--chart-4: var(--ocean-foam);      /* Light ocean */
--chart-5: var(--rust-accent);     /* Rust */
--chart-6: #6A9A84;                /* Sea green */
```

---

## Component Tokens

### Buttons
```css
--btn-primary-gradient: linear-gradient(180deg, 
  var(--terracotta) 0%, 
  var(--terracotta-deep) 100%
);
--shadow-fab: 0 4px 16px -2px rgba(196, 114, 74, 0.40);
```

### Tabs (Selected State)
```css
--tab-selected-bg: rgba(196, 114, 74, 0.12);
--tab-selected-text: var(--terracotta);
```

### Chips (Active State)
```css
--chip-include-bg: rgba(196, 114, 74, 0.12);
--chip-include-border: rgba(196, 114, 74, 0.45);
--chip-include-text: var(--terracotta-deep);
```

---

## PWA Theme

```json
{
  "background_color": "#F2E4D1",
  "theme_color": "#C4724A"
}
```

---

## Quick Reference

| Purpose | Token | Hex |
|---------|-------|-----|
| Background | `--sand-dry` | #F2E4D1 |
| Card | `--foam-white` | #FAFAF8 |
| **Primary Accent** | `--terracotta` | #C4724A |
| Text | `--ocean-deep` | #4A5968 |
| Success | `--success` | #5A9474 |
| Danger | `--danger` | #C45858 |

---

## Emotional Impact

### The Painting Says:
"Ocean meeting shore — cool depth, bright foam, warm earth"

### The Theme Communicates:
"You're at the beach. The warm orange sand is beneath you, the cool ocean is in front of you. This is a calm, grounded place to see your financial truth."

**The burnt orange terracotta isn't a subtle accent — it's the identity of the theme.**
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
