import AppShell from "@/components/shell/AppShell";
import { QuickLogProvider } from "@/components/log";
import ConvexClientProvider from "@/app/ConvexClientProvider";
import AuthGate from "@/components/AuthGate";
import OnboardingCheck from "@/components/OnboardingCheck";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ConvexClientProvider>
        <OnboardingCheck>
          <QuickLogProvider>
            <AppShell>{children}</AppShell>
          </QuickLogProvider>
        </OnboardingCheck>
      </ConvexClientProvider>
    </AuthGate>
  );
}
