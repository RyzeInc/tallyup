# TallyUp Branded Color System

## Design Principle
**"Standing at the shoreline: sky haze → ocean depth → foam → wet sand → dry sand"**

This color system transforms the "Warm Sand" theme into an unmistakably coastal experience. Every screen should communicate at least two beach elements (sand + ocean, foam + sun-coral, sea-glass + slate).

## Visual Thesis: Warm Sand = Coastal Daylight

| Element | Description |
|---------|-------------|
| **Base** | Clean warm sand + paper-white foam |
| **Identity** | Coastal teal (not neon), sea-glass mint, slate-ocean depth |
| **Highlight** | Sun-coral / terracotta used sparingly |
| **Texture** | Subtle grain + soft gradient drift (like light on sand/water) |
| **Motion** | Slow, fluid, damped (like waves), not bouncy |

---

## Beach Material System

### 🏖️ Sand System (Core Neutrals)

| Token | Hex | Usage |
|-------|-----|-------|
| `--sand-dry` | #F7F3ED | Background (bg) - warm off-white with hint of tan |
| `--sand-wet` | #EDE6DC | Elevated background - slightly deeper, cooler (damp) |
| `--foam-white` | #FDFCFA | Card surfaces - clean white, tiniest warmth |
| `--shell-cream` | #F9F6F1 | Inputs, chips - off-white |

### 💧 Ocean System (Brand Identity)

| Token | Hex | Usage |
|-------|-----|-------|
| `--ocean-slate` | #3D4F5F | Primary text - deep blue-gray |
| `--ocean-slate-light` | #5A6D7A | Secondary text - cooler gray |
| `--coastal-teal` | #2A7C8C | Primary accent - teal that's not tropical neon |
| `--coastal-teal-deep` | #1E6170 | Hover/active states |
| `--sea-glass` | #B8DCD9 | Badges, soft fills - minty tint |
| `--sea-glass-subtle` | rgba(184, 220, 217, 0.25) | Very light tint |

### ☀️ Sun-Coral System (Rare Highlight)

| Token | Hex | Usage |
|-------|-----|-------|
| `--sun-coral` | #D68A6C | Secondary accent - muted coral/terracotta |
| `--sun-coral-deep` | #C47258 | Hover state |
| `--amber-warmth` | #C9A052 | Warnings - sand-amber (not traffic cone) |

**Rule**: Coral is like the sun—felt, not everywhere. One "hero" highlight per screen max.

---

## The Shoreline Field (Primary Atmospheric Feature)

The #1 change that makes Warm Sand read "beach" is the Shoreline Field - a gradient overlay at the top of every primary screen.

### Gradient Structure
```
sky haze → ocean → foam fade → sand
```

### Implementation
- Height: ~160-240px (enough to be felt)
- Applied behind header + top tabs
- Fades out before content cards start

```css
--shoreline-field: 
  linear-gradient(180deg,
    var(--sky-haze) 0%,      /* Cool slate at top */
    var(--ocean-mid) 20%,     /* Ocean band */
    var(--coastal-teal) 35%,  /* Teal depth */
    var(--foam-band) 55%,     /* Foam transition */
    var(--sand-dry) 75%,      /* Fade to sand */
    var(--sand-dry) 100%
  );
```

---

## Surface Layers (4-Level System)

Beach is layered. Single-color backgrounds read "template," not "shoreline."

| Layer | Token | Material | Usage |
|-------|-------|----------|-------|
| 1 | `--bg` | Dry Sand | Default screen background |
| 2 | `--bg-elevated` | Wet Sand | Behind content sections |
| 3 | `--surface` | Foam White | Cards |
| 4 | `--surface-2` | Shell Cream | Chips, inputs |

---

## Foam Card Treatment

Cards should feel like foam surfaces, not white rectangles.

### Spec
- **Border**: Hairline, warm-gray at ~8% opacity (`--border-foam`)
- **Shadow**: Soft + wide, very low contrast (`--shadow-foam`)
- **Optional**: Subtle inner highlight at top edge (light catching foam)

```css
.card-foam {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, var(--surface) 8%);
  border: 1px solid var(--border-foam);
  box-shadow: var(--shadow-foam), var(--shadow-inner-highlight);
}
```

---

## Accent Usage Rules

### Coastal Teal (Primary Accent)
Teal should indicate water-like clarity:
- ✅ Selected state (tabs, chips)
- ✅ Primary actions
- ✅ Focus rings / active input
- ✅ Key "positive clarity" moments (safe-to-spend, confirmations)
- ✅ Line charts by default
- ❌ Don't outline everything in teal

### Sun Coral (Secondary, Rare)
Coral should indicate warmth/attention:
- ✅ Attention / "look here"
- ✅ Spending heat / spikes / alerts
- ✅ Highlight states (selected category)
- ✅ One "hero" highlight per screen max
- ❌ Not for general UI elements

---

## Typography (Ocean Slate)

Warm backgrounds reduce perceived contrast, so text must be crisp.

| Level | Token | Color | Usage |
|-------|-------|-------|-------|
| Primary | `--text` | Ocean Slate | Headlines, amounts |
| Secondary | `--muted` | Ocean Slate Light | Labels, meta |
| Tertiary | `--text-tertiary` | Cool gray | Metadata only |

---

## Semantic Money Colors

Must remain distinct while harmonizing with beach palette.

| Semantic | Hex | Description |
|----------|-----|-------------|
| Income | #3D8B72 | Green that harmonizes with teal (not bright lime) |
| Expense | #5A6D7A | Muted (uses `--muted`) |
| Danger | #C46B5C | Warm red harmonizing with coral (not harsh crimson) |
| Warning | #C9A052 | Sand-amber (not traffic cone orange) |

---

## Chart Colors (Coastal Palette)

Categories should feel like "found objects on the beach," not candy.

| Var | Color | Description |
|-----|-------|-------------|
| `--chart-1` | Coastal Teal | Primary |
| `--chart-2` | Sea Glass | Soft fills |
| `--chart-3` | Ocean Slate Light | Baseline |
| `--chart-4` | Amber Warmth | Sand-amber |
| `--chart-5` | Sun Coral | Highlight |
| `--chart-6` | #7A9A8A | Sea moss (muted green) |
| `--chart-7` | #9A8AA0 | Sea urchin (muted violet) |
| `--chart-8` | #A8A8A0 | Pebble (soft gray) |

### Chart-Specific
- **Line chart**: Teal line, sea-glass area fill (very low opacity)
- **Selected datapoint**: Coral dot (rare highlight)

---

## Component Styling

### Top Tabs
Modern iOS segmented control sitting on "foam"
- Container: Translucent foam chip, blur backdrop
- Selected: Sea-glass tint fill + teal text
- Unselected: Slate text at reduced opacity

### Buttons
Sea-glass / polished stones feel
- **Primary**: Teal gradient (subtle), with lifted shadow
- **Secondary**: Foam fill with border
- **Destructive**: Warm coral/red, restrained saturation

### Badges
Sea-glass tokens
- Background: `--sea-glass-subtle`
- Border: Hairline
- Text: Coastal teal deep

### Lists
Shoreline calm
- Alternating rows: Barely visible sand shift
- Selection: Sea-glass tint + teal left indicator

### Dividers (Tide Lines)
- Gradient line: Sand → transparent
- Or: Dotted micro-texture

---

## Texture

### Sand Grain
Very subtle noise/grain across bg (consistent, not per screen)

```css
.sand-grain::before {
  background-image: url("data:image/svg+xml,...");
  opacity: 0.03;
  mix-blend-mode: multiply;
}
```

### Wet Sand Sheen
On `--bg-elevated` sections, faint sheen gradient (damp sand reflecting sky)

---

## Motion (Coastal: Slow, Fluid, Damped)

If you animate anything in Warm Sand:
- Slower, damped easing (`--ease-wave`)
- Soft fades
- Gentle slide

| Token | Value | Usage |
|-------|-------|-------|
| `--motion-fast` | 120ms | Micro-interactions |
| `--motion-medium` | 200ms | Standard transitions |
| `--motion-slow` | 350ms | Significant changes |
| `--motion-wave` | 600ms | Coastal micro-animations |
| `--ease-wave` | cubic-bezier(0.25, 0.1, 0.25, 1) | Damped wave motion |

**Avoid** bouncy "playful" motion—beach is calm and premium.

---

## Acceptance Tests

A Warm Sand theme is successful if:

1. ✅ Screenshots read "coastal" even without a logo
2. ✅ Top of every primary screen shows shoreline field (cool → foam → sand)
3. ✅ Cards feel like foam surfaces, not white rectangles
4. ✅ Teal feels like water, coral feels like sun, sand feels like place
5. ✅ Charts feel like coastal palette, not default colors
6. ✅ Empty areas look intentional (grain + gradient), not blank

---

## CSS Variables Quick Reference

```css
:root, .light {
  /* Sand System */
  --sand-dry: #F7F3ED;
  --sand-wet: #EDE6DC;
  --foam-white: #FDFCFA;
  --shell-cream: #F9F6F1;
  
  /* Ocean System */
  --ocean-slate: #3D4F5F;
  --coastal-teal: #2A7C8C;
  --sea-glass: #B8DCD9;
  
  /* Sun-Coral System */
  --sun-coral: #D68A6C;
  --amber-warmth: #C9A052;
  
  /* Semantic */
  --primary: var(--coastal-teal);
  --success: #3D8B72;
  --danger: #C46B5C;
}
```

---

## Emotional Impact

### Before (Generic Warm)
- Screen says: "Here's a beige app"
- Feels like: A template

### After (Coastal Daylight)
- Screen says: "You're at the shoreline. Take a breath."
- Feels like: A calm, intentional place for financial truth

**This matters deeply** given TallyUp's focus on awareness and psychological honesty over optimization.
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
