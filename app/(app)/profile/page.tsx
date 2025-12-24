"use client";

import { SignedIn, SignedOut, useUser, SignOutButton, SignInButton } from "@clerk/nextjs";

export default function ProfilePage() {
  const user = useUser();

  return (
    <div>
      <div className="mb-4">
        <div className="text-2xl font-semibold tracking-tight">Profile</div>
        <div className="mt-1 text-sm text-neutral-400">Manage your account and sign out.</div>
      </div>

      <SignedIn>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
          <div className="text-sm font-medium">{user?.user?.fullName ?? user?.user?.primaryEmailAddress?.emailAddress ?? "—"}</div>
          <div className="mt-2 text-sm text-neutral-400">ID: {user?.user?.id}</div>
          <div className="mt-4">
            <SignOutButton>
              <button className="rounded-md bg-neutral-800 px-3 py-2 text-sm">Sign out</button>
            </SignOutButton>
          </div>
        </div>
      </SignedIn>

      <SignedOut>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4 text-sm text-neutral-300">
          <div className="mb-3">You are not signed in.</div>
          <SignInButton mode="modal">
            <button className="rounded-md bg-neutral-800 px-3 py-2 text-sm">Sign in</button>
          </SignInButton>
        </div>
      </SignedOut>
    </div>
  );
}
