#!/usr/bin/env node
// Check required environment variables for deployment.
//
// These are the names the code actually reads. ClerkProvider in app/layout.tsx
// is rendered without an explicit publishableKey, so @clerk/nextjs takes it from
// NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY at build time. Missing it does not fail here,
// it fails minutes later while prerendering, with an error that does not name the
// variable. Checking it up front turns that into an immediate, actionable message.
const required = [
  {
    names: ['NEXT_PUBLIC_CONVEX_URL'],
    why: 'Convex frontend URL (set by your Convex deployment)',
  },
  {
    names: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    why: 'Clerk publishable key, read by ClerkProvider during prerendering',
  },
  {
    // CLERK_API_KEY is the pre-v5 name for the same secret.
    names: ['CLERK_SECRET_KEY', 'CLERK_API_KEY'],
    why: 'Clerk server secret (for server-side auth)',
  },
];

const missing = required.filter((r) => !r.names.some((name) => process.env[name]));

if (missing.length > 0) {
  console.error('\nERROR: Missing required environment variables for build/deploy:\n');
  for (const r of missing) {
    console.error(` - ${r.names.join(' or ')}: ${r.why}`);
  }

  console.error('\nSuggested action: Add these variables in your Vercel project settings -> Environment Variables.\n');
  console.error('For Convex: deploy your Convex app and set NEXT_PUBLIC_CONVEX_URL to the Convex client URL.');
  console.error('For Clerk: copy NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY from your Clerk dashboard.');
  console.error('\nThis script does not read .env.local. Run it through `next build`, or export the variables first.');

  process.exit(1);
}

console.log('Environment check passed: required variables are present.');
process.exit(0);
