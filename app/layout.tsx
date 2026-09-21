import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { OptimisticLinksProvider } from "@/components/OptimisticLinksProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tallyup.app"),
  title: {
    default: "TallyUp — See where your money actually goes",
    template: "%s · TallyUp",
  },
  description:
    "TallyUp is an event-first personal finance app. Link your accounts, catch every recurring charge, and know what's safe to spend — built for awareness, not optimization.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TallyUp",
  },
  openGraph: {
    type: "website",
    siteName: "TallyUp",
    title: "TallyUp — See where your money actually goes",
    description:
      "Link your accounts, catch every recurring charge, and know what's safe to spend.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TallyUp — See where your money actually goes",
    description:
      "Link your accounts, catch every recurring charge, and know what's safe to spend.",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#4F6CFF",
  width: "device-width",
  initialScale: 1,
  // Pinch-to-zoom stays enabled: this is a screen full of small currency
  // figures, and disabling zoom fails WCAG 1.4.4.
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <meta name="color-scheme" content="light dark" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="TallyUp" />
          {/* Applies the persisted theme class before first paint so server HTML
              and client agree, and there is no flash of the default theme. */}
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
        <body style={{ minHeight: "100vh" }}>
          <ThemeProvider>
            <ToastProvider>
              <OptimisticLinksProvider>{children}</OptimisticLinksProvider>
            </ToastProvider>
          </ThemeProvider>
          <ServiceWorkerRegistration />
        </body>
      </html>
    </ClerkProvider>
  );
}
