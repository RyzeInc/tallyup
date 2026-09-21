import ConvexClientProvider from "@/app/ConvexClientProvider";
import AuthGate from "@/components/AuthGate";

/**
 * Full-screen setup flow.
 *
 * Deliberately does NOT render AppShell. Onboarding previously lived under the
 * (app) group, so it was nested inside AppShell's `height: 100vh; overflow:
 * hidden` container beneath the top nav. Its own `min-h-screen` then overflowed
 * the clipped parent and pushed the Continue button below the fold — visible
 * only if you zoomed out.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </AuthGate>
  );
}
