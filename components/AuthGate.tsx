"use client";

import React from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--card-foreground)" }}>
            <div className="text-lg font-semibold mb-3">Welcome — please sign in</div>
            <div className="text-sm text-neutral-400 mb-4">Sign in or create an account to access your data.</div>
            <div className="mb-4">
              <SignInButton mode="modal">
                <button className="rounded-md bg-neutral-800 px-3 py-2 text-sm">Sign in</button>
              </SignInButton>
            </div>
            <div className="text-sm text-neutral-500">Or <a href="/sign-in" className="underline">open the sign-in page</a>.</div>
          </div>
        </div>
      </SignedOut>
    </>
  );
}
