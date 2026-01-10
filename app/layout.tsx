import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./ConvexClientProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { OptimisticLinksProvider } from "@/components/OptimisticLinksProvider";
import AuthGate from "@/components/AuthGate";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "TallyUp - Event-First Personal Finance",
  description: "Event-first financial truth engine focused on awareness, not optimization",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TallyUp",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#2F6F85",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard">
      <html lang="en">
        <head>
          <meta name="color-scheme" content="light dark" />
          <link rel="manifest" href="/manifest.webmanifest" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="TallyUp" />
        </head>
        <body style={{ minHeight: "100vh" }}>
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
          <ServiceWorkerRegistration />
        </body>
      </html>
    </ClerkProvider>
  );
}
