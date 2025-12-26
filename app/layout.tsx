import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./ConvexClientProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { OptimisticLinksProvider } from "@/components/OptimisticLinksProvider";
import AuthGate from "@/components/AuthGate";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body style={{ background: "var(--bg)", minHeight: "100vh" }}>
          <ThemeProvider>
            <ToastProvider>
              <OptimisticLinksProvider>
                {/* Require sign-in for the app; show SignIn UI when SignedOut */}
                <AuthGate>
                  <ConvexClientProvider>{children}</ConvexClientProvider>
                </AuthGate>
              </OptimisticLinksProvider>
            </ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
