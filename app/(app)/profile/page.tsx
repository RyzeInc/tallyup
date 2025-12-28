"use client";

import { SignedIn, SignedOut, useUser, SignOutButton, SignInButton } from "@clerk/nextjs";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import * as Lucide from "lucide-react";

export default function ProfilePage() {
  const user = useUser();

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Manage your account and sign out"
      />

      <SignedIn>
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--primary-subtle)" }}
            >
              <Lucide.User className="h-6 w-6" style={{ color: "var(--primary)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-medium" style={{ color: "var(--text)" }}>
                {user?.user?.fullName ?? user?.user?.primaryEmailAddress?.emailAddress ?? "—"}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                ID: {user?.user?.id}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <SignOutButton>
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
              >
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>
      </SignedIn>

      <SignedOut>
        <EmptyState
          icon={<Lucide.LogIn className="h-7 w-7" style={{ color: "var(--text-tertiary)" }} />}
          title="Not signed in"
          subtitle="Sign in to access your profile and data."
          action={
            <SignInButton mode="modal">
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
              >
                Sign in
              </button>
            </SignInButton>
          }
        />
      </SignedOut>
    </div>
  );
}
