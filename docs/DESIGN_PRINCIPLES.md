0) The North Star: what “Mercury-grade” feels like

A modern fintech app feels:

Quiet (low visual noise), confident (clear hierarchy), predictable (consistent components), fast (perceived performance), trustworthy (status + provenance + reversible actions), and guided (always an obvious next step).

Depth exists, but it’s behind intentional interactions (drill-down, sheets, detail pages), not on the surface.

Your UI should make users think: “This app is stable, professional, and safe. I understand what’s happening.”

1) Non-negotiable product principles (LLM must obey)

These are invariants that should hold across every screen.

1.1 Calm UI, loud numbers

Money, dates, and statuses are the hero.

Decorative backgrounds, heavy borders, and “cute” styling are banned.

If two elements compete for attention, the app is wrong.

Rule: the largest/strongest text on a screen is either:

a primary amount, or

a primary action title.

1.2 One primary action per screen

Each screen gets one primary CTA. Everything else is secondary/tertiary.

Rule: if you see two filled buttons on one screen, you probably failed.

1.3 Progressive disclosure by default

Complex controls are hidden until asked for.

Filters collapse into a single “Filter” entry point (sheet/drawer).

Rules, tagging, recurring logic show only in detail/expand states.

Advanced insights are “View more” and drill-down, not a massive dashboard.

1.4 Consistency beats creativity

Every screen must look like it’s built from the same kit:

same spacing scale

same typography scale

same button hierarchy

same list row pattern

same empty/loading/error states

Rule: if a component is slightly different somewhere, it’s a bug.

1.5 Trust is a feature

Fintech UX must include:

clear statuses (pending/posted/synced)

provenance (“where did this data come from?”)

safe destructive actions (undo, confirmations)

audit-friendly detail views

2) Visual system specification (tokens + rules)

This is what makes “modern” possible even before you redesign screens.

2.1 Color strategy (do this, don’t negotiate)

Goal: neutral base, restrained accents.

Base palette (conceptual)

Canvas: near-white / very light gray

Surface: white

Border: subtle gray (1px)

Text: near-black for primary, medium gray for secondary, light gray for disabled

Accent: one brand accent color (used sparingly)

Status: green/red/amber only for semantic meaning (not branding)

Hard rules

No saturated background fills behind entire pages.

No tinted transaction cards by default (green/red backgrounds are too loud).

Use text color + small icons for income/expense status; reserve color fills for alerts only.

2.2 Typography scale (enforce everywhere)

Choose one modern sans (Inter / system). Define a scale:

H1: Page title

KPI: Primary amount (largest numeric)

H2: Section headers

Body: Row titles and primary text

Meta: Dates, categories, helper text

Micro: Chips, captions

Hard rules

Meta text must be lower contrast than body.

Amount alignment is consistent (usually right-aligned in lists).

Use tabular numerals (helps finance scanning).

2.3 Spacing & layout rhythm (8pt grid)

Use only: 4, 8, 12, 16, 24, 32, 40, 48.

Hard rules

Card padding is constant (typically 16).

Section spacing is constant (typically 24).

List row height is consistent (e.g., 56–72 mobile depending on density).

Touch targets: minimum 44x44.

2.4 Radii, borders, shadows

Border: 1px subtle

Radius: consistent (e.g., 12)

Shadow: soft and rare; most separation comes from spacing + subtle borders

Hard rule

If everything has a shadow, nothing feels premium. Use shadows for overlays, not every card.

2.5 Iconography

One icon set only. One stroke weight only.

Hard rules

No emojis in navigation

No mixed icon styles

Icons are secondary to text labels on mobile nav

2.6 Motion

Motion is purposeful, not decorative:

skeleton loading

subtle transitions for sheets/menus

no bouncy animations

Hard rule

All motion must respect “Reduce Motion.”

3) Component hierarchy (the “Mercury kit”)

Your LLM should implement and use these primitives everywhere.

3.1 Buttons (3 levels only)

Primary: filled, used once per screen

Secondary: outline/soft, used sparingly

Tertiary: text button or icon button

Destructive: red text/outline; confirmations required for irreversible actions.

Hard rule

No custom button styles per page.

3.2 Inputs

text input with label + optional helper

inline validation (calm, precise)

keyboard type tuned (numeric for amounts)

optional “smart defaults” (today’s date, last used bucket)

Rule: form fields never appear “repeated” for every item in a list. Forms belong in detail/expanded view.

3.3 Chips / pills

Chips must be:

compact

low emphasis

used for filters and tags, not as primary navigation

Rule: if chips dominate above-the-fold, move them into a Filter sheet.

3.4 Cards

Use cards as containers, not as decoration.

consistent padding

consistent header row patterns (title left, action right)

consistent dividers

3.5 Lists (this is the fintech backbone)

Transactions, inbox items, rules, categories all follow the same list language.

Transaction row pattern (must be consistent)

Left: merchant / title (primary)

Left subline: category • bucket • date (meta)

Right: amount (primary)

Right subline: status (pending/posted/synced) (meta)

Optional leading icon/avatar: subtle

Row actions

Mobile: swipe actions (edit / delete / mark recurring)

Desktop: hover-reveal actions or overflow menu

Hard rule: action buttons should not always be visible on every row (that’s clutter).

3.6 Sheets, drawers, dialogs

Filters open in a bottom sheet (mobile) / side panel (desktop)

Transaction details open as a detail page or panel (depending on platform)

Confirmation dialogs are short and specific

Toasts/snackbars confirm completion + provide Undo when safe

4) Navigation & IA (mobile + desktop)

This is where your current UI is most “prototype-like”: too many top-level items and too much density.

4.1 Mobile bottom nav (max 4 + central Add)

Recommended structure:

Home

Activity

Add (center FAB)

Insights

More

Where:

Inbox/Review is not a tab unless it’s the #1 daily behavior. Otherwise it becomes:

a prominent Home module (“Needs review: 3”), and

a filter state within Activity.

Rules + Settings always live in More.

Hard rule: bottom nav must never exceed 5 items, and labels must be short.

4.2 Desktop nav

Left sidebar is fine, but keep it calm:

Group items (Core / Insights / Settings)

Reduce rarely-used items

Provide “Add” and “Search” as global actions, not menu clutter

Hard rule: don’t replicate mobile nav onto desktop 1:1; each platform should feel native.

5) Screen templates (LLM can apply anywhere)

These are reusable “page blueprints” to keep things uniform.

5.1 Home dashboard template (personal finance)

Home should answer, in this order:

Where am I right now? (net for period + cashflow summary)

What needs attention? (review, anomalies, bills, recurring suggestions)

What changed? (trend + top drivers)

What’s the next action? (Add, review, fix categories)

Home modules (mobile)

Above the fold should be at most 3 modules:

Cashflow snapshot (Income, Spend, Net)

Attention (Needs review, uncategorized, duplicates, recurring suggestions)

Mini trend (line last 30 days) OR Top drivers (top categories)

Everything else is “View more”.

Hard rule: avoid pie charts on mobile home. Use ranked lists or compact bars.

5.2 Activity (transactions) template

Sticky search

One-line filter summary (e.g., “This month · All accounts · 2 filters”)

Filter button opens sheet

List rows consistent

Hard rule: filters never consume > ~15% of vertical space by default.

5.3 Inbox/review template (categorization workflow)

Inbox should feel like a “queue,” not a repeated form page.

Default: compact list of items needing review

Tap item → expands into detail editor:

category picker

bucket

tags (optional)

recurring toggle (optional)

Save/Done

Hard rule: no “Type category…” fields shown for every list item simultaneously.

5.4 Insights template

Insights must be:

opinionated

digestible

drill-down friendly

Structure:

top: timeframe selector

2–4 headline metrics

2–3 insight cards (e.g., “Groceries up 18% vs last month”)

tap an insight → filtered transaction view

Hard rule: every chart must link to “show me the transactions behind this.”

5.5 Rules template

Rules are inherently complex, so:

show rule list with plain-language summaries

editing is in a dedicated screen/sheet with validation and preview

show “what would change if enabled” as an explanation

6) Content and microcopy (welcome + trust)

Modern fintech copy is:

short

precise

calm

non-judgmental

6.1 Labels and terms

Standardize:

“Income” / “Spending” / “Net”

“Pending” / “Posted”

“Needs review”

“Recurring”

“Category” / “Bucket” (and define them once in onboarding/help)

Hard rule: one concept = one name everywhere.

6.2 Helper text principles

Always explain what’s happening with automation:

“We think this is recurring based on pattern X.”

“Nothing is auto-linked until you confirm.”

6.3 Empty states

Every empty state must include:

what this section is for

how to populate it

a single CTA

Example pattern:

“No transactions yet.”

“Add your first entry to start tracking.”

CTA: “Add entry”

7) Trust, safety, and “fintech legitimacy” cues

Even for a lightweight app, you need “this is safe” signals.

7.1 Status and provenance

Every transaction should have:

status (pending/posted/manual)

source (manual entry, imported, rule-applied)

last updated timestamp (in detail view)

7.2 Reversibility

Undo toast for deletes when safe

“Archive” instead of delete for some actions

Confirmation dialog for irreversible actions

7.3 Audit-ready detail view

Transaction detail should be clean and complete:

amount, date, merchant/title

category/bucket/tags

notes

recurring link (if any)

change history (optional but strong trust feature)

“why was this categorized this way?” (rule explanation)

7.4 Privacy and security language

In settings/about/help:

plain explanation of data storage, encryption claims only if true

permission rationale screens when requesting anything sensitive

8) Accessibility & usability requirements (modern apps don’t skip this)

Contrast meets WCAG for text

Dynamic type support

Focus states everywhere (keyboard)

Screen reader labels for all controls

Hit targets >= 44px

Reduce motion support

Hard rule: no placeholder-only labels. Always have real labels.

9) Performance & perceived speed (Mercury feels fast)

Modern feel is heavily influenced by latency handling.

9.1 Loading states

skeletons for lists and cards

no spinners replacing the whole page

preserve layout during loading to avoid jank

9.2 Optimistic UI

For logging and categorization:

apply updates instantly

reconcile in background

show errors as inline non-blocking banners/toasts

9.3 Offline-ish behavior

If requests fail:

queue actions

show “Not synced” badge

allow retry

10) Charting rules (avoid “dashboard clutter”)

Charts should be small, purposeful, and secondary to numbers.

Every chart needs:

a clear label

timeframe

tap to drill down into transactions

Hard rules

Avoid pie charts on mobile home.

Prefer ranked bars and trend lines.

Show “Top 3–5” with a “View all.”

11) Quality bar: definition of done (LLM can self-check)

For every UI change, require:

11.1 Consistency checks

Uses only design tokens

Uses only shared components

No one-off margins/paddings

Same button hierarchy everywhere

11.2 Screen checks

One primary action

Filters are collapsed by default

Empty/loading/error states exist

Drill-down exists from insights to transactions

11.3 Clutter checks

No repeated forms in lists

No always-visible row action buttons

No excessive chip rows above content

12) “Mercury lessons” translated into concrete instructions

This is the part you want to hand to Claude.

12.1 Mercury pattern: “overview + action items + drill-down”

Instruction: restructure Home to:

show 2–4 KPIs

show “Needs attention” queue

show 1 small trend

provide “View more” for depth

12.2 Mercury pattern: “filters are tools, not furniture”

Instruction: remove large filter blocks from page body; replace with:

a filter button with count badge

a bottom sheet containing all filter controls

12.3 Mercury pattern: “row density + scanability”

Instruction: redesign transactions as a consistent list row template with:

left title + meta

right amount + status

swipe/overflow actions

12.4 Mercury pattern: “calm surfaces”

Instruction: remove colored page backgrounds and tinted cards; use:

neutral canvas

subtle borders

restrained accent color usage

13) A copy/paste instruction block for Claude Opus (design-principle driven)

Use this as your “always works” prompt for refactors:

Prompt to give Claude:

You are refactoring TallyUp UI/UX to match modern fintech standards similar to Mercury: calm, consistent, minimal, trustworthy.

Implement a design system with tokens (color, typography, spacing, radius, shadow) and enforce usage across all screens.

Reduce visual noise: remove page background tints and tinted transaction cards; use neutral surfaces with subtle borders.

Enforce component hierarchy: one primary CTA per screen; secondary/tertiary actions never compete visually.

Replace “filter blocks” with a Filter button that opens a bottom sheet/drawer containing all filters.

Refactor transaction lists into a single consistent row template (title/meta left, amount/status right). Move row actions to swipe or overflow.

Refactor Inbox so items are compact by default and expand-on-tap for categorization. No repeated form fields for every list item.

Mobile nav: max 4 tabs + center Add FAB; move Rules and Settings under More.

Add complete states: loading skeletons, empty states with CTA, error states, undo for safe destructive actions.

Ensure accessibility: contrast, labels, focus states, 44px hit targets, reduce motion.

Every insight/chart must drill down to the underlying transactions.

Deliverables:

tokens/theme file,

shared component library,

refactored Home, Activity/History, Inbox screens using only those components,

navigation restructure,

state handling for loading/empty/error.

Core Philosophy: Money UI Should Reduce Cognitive & Emotional Load

Modern fintech leaders (Mercury, Stripe, Linear, Notion Finance tools) converge on one principle:

Money interfaces should feel emotionally neutral, calm, and quietly empowering.

That directly informs color choice.

You are not designing:

A trading app (high contrast, aggressive greens/reds)

A budgeting guilt app (harsh warnings, judgmental reds)

A gamified savings app (bright dopamine colors)

You are designing a financial control surface—something users trust with their lives.

Base Background: Warm Off-White / Soft Neutral (Not Pure White)
Why not pure white?

Pure white (#FFFFFF):

Feels clinical and harsh

Causes eye fatigue in long sessions

Amplifies contrast in a way that makes money feel “sharp” and stressful

Why warm off-white / parchment-like neutrals?

The soft beige / warm gray background you see in the designs does three things:

Reduces anxiety

Warm neutrals subconsciously feel safer than stark white or dark mode

Especially important for users with financial stress

Feels human, not institutional

Mercury uses subtle warmth to avoid “bank lobby energy”

TallyUp benefits even more because this is personal finance

Allows cards to breathe

Cards feel like objects on a surface, not blocks on a screen

Outcome:
Users can stay longer, scan faster, and don’t feel “judged” by the interface.

Cards: White with Subtle Shadow (No Borders)
Why cards?

Cards:

Chunk information into digestible units

Allow modular rearrangement later

Scale naturally from mobile → desktop

Why no heavy borders?

Borders:

Create visual noise

Segment too aggressively

Feel outdated in modern UI

Instead:

Soft elevation

Gentle shadow

Rounded corners

This mirrors Mercury exactly:

The UI feels layered, not boxed.

Outcome:
Information feels grouped without feeling constrained.

Semantic Color Use (Extremely Restrained)
Income / Positive Movement

Soft green

Muted, not neon

Used only for deltas or confirmation

Why:
Green is powerful—overuse turns it into noise.

Expenses / Negative Movement

Neutral dark text

No aggressive red by default

Red is reserved for:

Errors

Warnings

Risk states

Why this matters:
Users should not feel punished for spending money.

Mercury does this very deliberately—and it’s one of the reasons their UI feels mature.

Attention States: Amber / Soft Orange (Not Red)

For:

“Needs review”

“Attention needed”

Incomplete actions

Why amber?

Signals importance without danger

Encourages action without panic

Reads as “in progress” rather than “wrong”

This aligns with your philosophy:

Growth through awareness, not shame.