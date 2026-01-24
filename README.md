This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## TallyUp - Event-First Personal Finance PWA

TallyUp is an installable Progressive Web App focused on financial truth, resilience, and fast daily use.

### PWA Features ✨

- 📱 **Installable**: Add to home screen on mobile and desktop
- ⚡ **Fast**: Conservative caching of static assets for instant load times
- 🔒 **Secure**: Zero caching of auth tokens or financial data
- 🌐 **Offline Ready**: Graceful offline fallback page
- 🎨 **Native Feel**: Full-screen standalone mode

See [docs/PWA_GUIDE.md](docs/PWA_GUIDE.md) for complete PWA documentation.

## Quick Start - Generate PWA Icons

Before running the app, generate the required PWA icons:

**Option 1: Using Node.js (requires sharp)**
```bash
npm install sharp
node scripts/generate-icons.js
```

**Option 2: Using Browser (no dependencies)**
1. Open `http://localhost:3000/generate-icons.html` after starting the dev server
2. Click "Generate All Icons"
3. Download each icon and save to `/public/icons/` with the exact filename shown

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
.
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Financial Coach (Alpha) Env Vars

```bash
# Alpha-safe defaults (no external LLM calls)
ALPHA_COST_GUARD=true
LLM_ENABLED=false
LLM_PROVIDER=mock

# Optional Groq provider (OpenAI-compatible)
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant

# Cost guardrails
LLM_DAILY_USER_MAX=20
LLM_DAILY_GLOBAL_MAX=500

# Plaid must remain sandbox for alpha
PLAID_ENV=sandbox
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Additional deployment notes and required environment variables are in [DEPLOYMENT.md](./DEPLOYMENT.md). The build now runs a prebuild check to verify required environment variables are set (see `scripts/check-env.js`).
