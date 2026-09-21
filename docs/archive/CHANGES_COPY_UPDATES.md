Changelog: UI Copy & Naming Updates

Summary:
- Updated UI labels and microcopy to a human-first naming system per product direction.

What changed:
- Tabs: Log -> Add, Inbox -> Review, History -> Activity, Summary -> Overview, Recurring -> Patterns
- Buttons & CTAs: Save pattern / Save as pattern, Add entry, Confirm, Use last, Remove (with Undo), Add entry
- Fields: Bucket -> Area (UI labels/placeholder), Purpose -> For, Method -> Account
- Recurring -> Pattern; Autolink -> Auto-apply (UI wording)
- Statuses: Not finished -> Needs review; Finished -> Confirmed; Changed by automation -> Auto-applied; Detected similarity -> Pattern suggested
- Small copy passes across `app/(app)/log`, `app/(app)/inbox`, `app/(app)/history`, `app/(app)/summary`, `components/RecurringModal`, `components/EntryCard`, `components/TabShell`, `components/BottomNav`.

Notes:
- Database field `autolinkEnabled` remains as-is (server flag). UI language uses "Auto-apply".
- Added `app/(app)/recurring/page.tsx` as a placeholder for Patterns management.
- Added a basic test for `RecurringModal` auto-apply confirmation (requires installation of testing deps).

Next steps:
- Run `npm i` to install testing dependencies, run `npm test`, and verify UI across pages.
- Consider regenerating Convex client with `npx convex dev` if schema changes need updated types.
