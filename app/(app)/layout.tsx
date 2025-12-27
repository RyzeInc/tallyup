import AppShell from "@/components/shell/AppShell";
import { PersistentTabsProvider } from "@/components/PersistentTabs";
import { TimeRangeProvider } from "@/components/TimeRangeProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersistentTabsProvider>
      <TimeRangeProvider>
        <AppShell>{children}</AppShell>
      </TimeRangeProvider>
    </PersistentTabsProvider>
  );
}
