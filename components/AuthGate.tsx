"use client";

import React from "react";
import { SignedIn, SignedOut, RedirectToSignIn, ClerkLoading, ClerkLoaded } from "@clerk/nextjs";

/**
 * Defense-in-depth auth boundary for the authenticated route groups.
 *
 * Primary enforcement lives in middleware.ts, which runs at the edge and
 * redirects unauthenticated requests before this component is ever reached.
 * This previously wrapped the entire root layout and rendered an inline card
 * linking to a /sign-in route that did not exist, which also made it
 * impossible for any public page to exist.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClerkLoading>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--bg-full)" }}
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">Loading your account…</span>
          <div
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "2px solid var(--border)",
              borderTopColor: "var(--primary)",
              animation: "spin 700ms linear infinite",
            }}
          />
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        <SignedIn>{children}</SignedIn>
        <SignedOut>
          <RedirectToSignIn />
        </SignedOut>
      </ClerkLoaded>
    </>
  );
}
