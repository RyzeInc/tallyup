import { AuthConfig } from "convex/server";

/**
 * Clerk JWT issuer domain. Must be set per-deployment via:
 *   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-instance>.clerk.accounts.dev
 * (or your production Clerk Frontend API domain).
 *
 * Previously this was hardcoded to a development Clerk instance, which meant a
 * production deployment would validate tokens against the dev tenant.
 */
const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!domain) {
  throw new Error(
    "Missing CLERK_JWT_ISSUER_DOMAIN in the Convex deployment environment. " +
      "Set it with: npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-instance>"
  );
}

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
