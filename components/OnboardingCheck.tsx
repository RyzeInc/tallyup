"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Sends genuinely new users to the setup flow, once.
 *
 * Deliberately fails open. The previous version returned `null` whenever
 * preferences were missing or still loading, which meant:
 *   - a user with no userPreferences row saw a permanently blank app, because
 *     getUserPreferences returns null for them and the redirect effect bailed
 *     on the same condition; and
 *   - every account predating the onboardingCompleted flag was pushed back
 *     through setup, since the flag is undefined there.
 *
 * Now the app always renders, and the redirect only fires for users the server
 * confirms are starting empty (see preferences.getOnboardingStatus).
 */
export default function OnboardingCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useQuery(api.preferences.getOnboardingStatus);
  const redirected = useRef(false);

  useEffect(() => {
    if (!status?.shouldOnboard) return;
    if (pathname === "/onboarding") return;
    // Only ever redirect once per mount, so a user who navigates back out of
    // onboarding is not trapped in a loop.
    if (redirected.current) return;
    redirected.current = true;
    router.push("/onboarding");
  }, [status, pathname, router]);

  return <>{children}</>;
}
