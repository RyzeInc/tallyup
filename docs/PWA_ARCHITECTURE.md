# TallyUp PWA Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Device                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Browser / Home Screen                 │   │
│  │                                                           │   │
│  │  📱 TallyUp Icon (Installed PWA)                        │   │
│  │      ↓                                                   │   │
│  │  ┌─────────────────────────────────────┐               │   │
│  │  │   Standalone App (Full Screen)      │               │   │
│  │  │                                      │               │   │
│  │  │   ┌──────────────────────────┐     │               │   │
│  │  │   │  Service Worker (sw.js)  │     │               │   │
│  │  │   │  ┌────────────────────┐  │     │               │   │
│  │  │   │  │  Cache Strategy:   │  │     │               │   │
│  │  │   │  │                    │  │     │               │   │
│  │  │   │  │  ✅ HTML pages     │  │     │               │   │
│  │  │   │  │  ✅ JS bundles     │  │     │               │   │
│  │  │   │  │  ✅ CSS files      │  │     │               │   │
│  │  │   │  │  ✅ Images/icons   │  │     │               │   │
│  │  │   │  │                    │  │     │               │   │
│  │  │   │  │  ❌ Auth tokens    │  │     │               │   │
│  │  │   │  │  ❌ API data       │  │     │               │   │
│  │  │   │  │  ❌ User records   │  │     │               │   │
│  │  │   │  │  ❌ Convex DB      │  │     │               │   │
│  │  │   │  └────────────────────┘  │     │               │   │
│  │  │   └──────────────────────────┘     │               │   │
│  │  │                                      │               │   │
│  │  │   ┌──────────────────────────┐     │               │   │
│  │  │   │  Next.js App Shell       │     │               │   │
│  │  │   │  ├─ /summary            │     │               │   │
│  │  │   │  ├─ /log                │     │               │   │
│  │  │   │  ├─ /inbox              │     │               │   │
│  │  │   │  ├─ /history            │     │               │   │
│  │  │   │  └─ /offline (fallback) │     │               │   │
│  │  │   └──────────────────────────┘     │               │   │
│  │  └─────────────────────────────────────┘               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Network (when online)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Backend Services                         │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Clerk      │    │   Convex     │    │   Next.js    │     │
│  │   (Auth)     │    │   (Database) │    │   (Server)   │     │
│  │              │    │              │    │              │     │
│  │  • Tokens    │    │  • Entries   │    │  • SSR       │     │
│  │  • Sessions  │    │  • Queries   │    │  • API       │     │
│  │  • Users     │    │  • Mutations │    │  • Routes    │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                   │
│  ❌ NEVER CACHED - Always fetched fresh from network            │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════

PWA File Structure:

/public/
  ├─ manifest.webmanifest    ← App metadata (name, icons, colors)
  ├─ sw.js                   ← Service worker (caching logic)
  ├─ generate-icons.html     ← Browser-based icon generator
  └─ icons/
      ├─ icon.svg            ← Source SVG design
      ├─ icon-192.png        ⚠️  Generate this
      ├─ icon-512.png        ⚠️  Generate this
      ├─ icon-192-maskable.png ⚠️ Generate this
      └─ icon-512-maskable.png ⚠️ Generate this

/app/
  ├─ layout.tsx              ← PWA metadata + SW registration
  └─ offline/
      └─ page.tsx            ← Offline fallback page

/components/
  ├─ ServiceWorkerRegistration.tsx ← Auto-registers SW
  └─ PWAInstallPrompt.tsx           ← Optional install UI

/scripts/
  └─ generate-icons.js       ← Node.js icon generator

/docs/
  ├─ PWA_GUIDE.md           ← Complete documentation
  └─ PWA_CHECKLIST.md       ← Quick start guide

═══════════════════════════════════════════════════════════════════

Network Behavior:

Online Mode:
  1. User opens app
  2. Service worker intercepts requests
  3. Static assets: Try cache → Fallback to network
  4. Auth/API/Data: Always fetch from network (bypass cache)
  5. App functions normally with fresh data

Offline Mode:
  1. User opens app
  2. Service worker intercepts requests
  3. Static assets: Serve from cache (instant load)
  4. Auth/API/Data: Network unavailable
  5. Page navigation: Show /offline fallback
  6. User sees branded offline page with retry option

App Update:
  1. New version deployed
  2. Service worker detects update
  3. User sees "New version available" prompt
  4. User confirms → Page reloads
  5. Old cache cleared, new cache populated

═══════════════════════════════════════════════════════════════════

Installation Flow:

Mobile (Android):
  1. User visits https://tallyup.app
  2. Chrome shows "Add to Home Screen" banner
  3. User taps "Install"
  4. Icon appears on home screen
  5. User taps icon → Opens in standalone mode

Mobile (iOS):
  1. User visits https://tallyup.app in Safari
  2. User taps Share → "Add to Home Screen"
  3. Icon appears on home screen
  4. User taps icon → Opens without Safari UI

Desktop:
  1. User visits https://tallyup.app in Chrome
  2. Install icon appears in address bar
  3. User clicks install
  4. App window opens (looks like native app)

═══════════════════════════════════════════════════════════════════

Key Features:

✅ Installable     → Add to home screen, standalone mode
✅ Fast            → Static assets cached for instant load
✅ Offline Ready   → Graceful offline page, auto-retry
✅ Secure          → Financial data never cached
✅ Update Support  → Automatic updates with user prompt
✅ Native Feel     → Full-screen, no browser UI
✅ Shortcuts       → Quick actions from home screen icon

═══════════════════════════════════════════════════════════════════
```
