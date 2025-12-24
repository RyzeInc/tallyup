import AppShell from "@/components/shell/AppShell";
import { QuickLogProvider } from "@/components/log";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QuickLogProvider>
      <AppShell>{children}</AppShell>
    </QuickLogProvider>
  );
}
