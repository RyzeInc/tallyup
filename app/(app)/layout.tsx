import AppShell from "@/components/shell/AppShell";
import { PersistentTabsProvider } from "@/components/PersistentTabs";
import { QuickLogProvider } from "@/components/log";
import OnboardingCheck from "@/components/OnboardingCheck";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingCheck>
      <PersistentTabsProvider>
        <QuickLogProvider>
          <AppShell>{children}</AppShell>
        </QuickLogProvider>
      </PersistentTabsProvider>
    </OnboardingCheck>
  );
}
