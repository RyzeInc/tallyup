import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import TabShell from "@/components/TabShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}>
      <div className="mx-auto max-w-md px-4 pt-6 pb-24" style={{ minHeight: "calc(100vh - 84px)", position: "relative" }}>
        <div className="mb-6 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
        <TabShell />
      </div>
      <BottomNav />
    </div>
  );
}
