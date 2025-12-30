import AppShell from "@/components/shell/AppShell";
import { PersistentTabsProvider } from "@/components/PersistentTabs";
import { TimeRangeProvider } from "@/components/TimeRangeProvider";
import { QuickLogProvider } from "@/components/log";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersistentTabsProvider>
      <TimeRangeProvider>
        <QuickLogProvider>
          <AppShell>{children}</AppShell>
        </QuickLogProvider>
      </TimeRangeProvider>
    </PersistentTabsProvider>
  );
}
