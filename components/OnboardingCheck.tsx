"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function OnboardingCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const userPrefs = useQuery(api.preferences.getUserPreferences);

  useEffect(() => {
    // Skip check if already on onboarding page or loading
    if (!userPrefs || pathname === "/onboarding") {
      return;
    }

    // If user hasn't completed onboarding, redirect to it
    if (!userPrefs.onboardingCompleted) {
      router.push("/onboarding");
    }
  }, [userPrefs, pathname, router]);

  // Show nothing while checking (redirect in progress)
  if (userPrefs === undefined || userPrefs === null) {
    return null;
  }

  // If not completed and not on onboarding page, don't render
  if (!userPrefs.onboardingCompleted && pathname !== "/onboarding") {
    return null;
  }

  return children;
}

