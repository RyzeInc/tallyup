import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}>
      <div className="mx-auto max-w-md px-4 pt-6 pb-24">
        <div className="mb-6 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
