import AppShell from "@/components/shell/AppShell";
import { QuickLogProvider } from "@/components/log";
import { PersistentTabsProvider } from "@/components/PersistentTabs";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersistentTabsProvider>
      <QuickLogProvider>
        <AppShell>{children}</AppShell>
      </QuickLogProvider>
    </PersistentTabsProvider>
  );
}
