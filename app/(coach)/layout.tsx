import AppShell from "@/components/shell/AppShell";
import { QuickLogProvider } from "@/components/log";
import ConvexClientProvider from "@/app/ConvexClientProvider";
import AuthGate from "@/components/AuthGate";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ConvexClientProvider>
        <QuickLogProvider>
          <AppShell>{children}</AppShell>
        </QuickLogProvider>
      </ConvexClientProvider>
    </AuthGate>
  );
}
