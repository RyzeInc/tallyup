import AppShell from "@/components/shell/AppShell";
import { PersistentTabsProvider } from "@/components/PersistentTabs";
import { QuickLogProvider } from "@/components/log";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersistentTabsProvider>
      <QuickLogProvider>
        <AppShell>{children}</AppShell>
      </QuickLogProvider>
    </PersistentTabsProvider>
  );
}
