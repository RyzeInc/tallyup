import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a TallyUp account and link your first account.",
};

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center px-4" style={{ minHeight: "70vh", paddingTop: 48, paddingBottom: 48 }}>
      <SignUp
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}
