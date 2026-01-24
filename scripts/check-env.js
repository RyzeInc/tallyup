#!/usr/bin/env node
// Check required environment variables for deployment
const required = [
  { name: 'NEXT_PUBLIC_CONVEX_URL', why: 'Convex frontend URL (set by your Convex deployment)' },
  { name: 'NEXT_PUBLIC_CLERK_FRONTEND_API', why: 'Clerk frontend API for authentication' },
  { name: 'CLERK_API_KEY', why: 'Clerk server API key (for server-side auth)' },
];

const missing = required.filter(r => !process.env[r.name]);

if (missing.length > 0) {
  console.error('\nERROR: Missing required environment variables for build/deploy:\n');
  for (const r of missing) {
    console.error(` - ${r.name}: ${r.why}`);
  }

  console.error('\nSuggested action: Add these variables in your Vercel project settings -> Environment Variables.\n');
  console.error('For Convex: deploy your Convex app and set NEXT_PUBLIC_CONVEX_URL to the Convex client URL.');
  console.error('For Clerk: set NEXT_PUBLIC_CLERK_FRONTEND_API and CLERK_API_KEY from your Clerk dashboard.');
  console.error('\nIf you don\'t need Clerk or Convex features for your deployment (e.g., static demo), you can stub them with safe defaults, but production deployments should use real credentials.');

  process.exit(1);
}

console.log('Environment check passed: required variables are present.');
process.exit(0);
