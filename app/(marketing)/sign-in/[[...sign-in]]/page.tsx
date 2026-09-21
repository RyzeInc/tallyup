import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your TallyUp account.",
};

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center px-4" style={{ minHeight: "70vh", paddingTop: 48, paddingBottom: 48 }}>
      <SignIn
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}
