import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ padding: 24 }}>
      <SignedOut>
        <SignInButton mode="modal">
          <button>Sign in</button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <UserButton />
          <div>Signed in.</div>
        </div>
      </SignedIn>
    </div>
  );
}
