# Deployment notes (Vercel)

Follow these steps to deploy TallyUp on Vercel and ensure runtime features (Convex, Clerk, Plaid) work:

1. Deploy Convex
   - Ensure you have a Convex app and copy the Convex client URL from the Convex dashboard.
   - Set `NEXT_PUBLIC_CONVEX_URL` in Vercel to that URL.

2. Configure Clerk
   - In your Clerk dashboard, copy the frontend API and server API key.
   - Set the following Vercel environment variables:
     - `NEXT_PUBLIC_CLERK_FRONTEND_API` (frontend API)
     - `CLERK_API_KEY` (server API key)

3. (Optional) Configure Plaid for banking features
   - Set the following environment variables in Vercel if you want Plaid functionality:
     - `PLAID_CLIENT_ID`
     - `PLAID_SECRET`
     - `PLAID_ENV` (defaults to `sandbox`)
     - `PLAID_REDIRECT_URI` (if using OAuth institutions)

4. Vercel build command
   - The project uses the standard `npm run build` command. A prebuild step (`prebuild`) checks for required environment variables and will fail early with instructions if any required variables are missing.

5. Helpful notes
   - If you prefer to test a static preview without backend integrations, you can set placeholder values for the required variables, but features that depend on Convex/Clerk/Plaid will not function.
   - If you make changes to Convex server functions, regenerate `convex/_generated` if needed (see Convex docs or run `npx convex dev` locally).

If you'd like, I can add a Vercel project template or a small CI workflow that validates these envs automatically and optionally runs `npm run check` (lint + Convex typecheck) as part of PR validation. Let me know which you prefer.
