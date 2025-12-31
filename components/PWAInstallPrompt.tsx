"use client";

import { useEffect, useState } from "react";

/**
 * PWA Install Prompt Component
 * 
 * Optional component to show a custom install prompt.
 * Add this to your UI where you want the install button to appear.
 * 
 * Example usage:
 * ```tsx
 * import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
 * 
 * export default function Page() {
 *   return (
 *     <div>
 *       <PWAInstallPrompt />
 *       // ... rest of your page
 *     </div>
 *   );
 * }
 * ```
 */
export function PWAInstallPrompt() {
  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    // Listen for the install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
      console.log("[PWA] App installed successfully");
    };

    // Custom event from ServiceWorkerRegistration
    const handlePWAInstallAvailable = (e: CustomEvent) => {
      setDeferredPrompt(e.detail as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("pwa-install-available", handlePWAInstallAvailable as EventListener);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("pwa-install-available", handlePWAInstallAvailable as EventListener);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response: ${outcome}`);

    if (outcome === "accepted") {
      console.log("[PWA] User accepted the install prompt");
    } else {
      console.log("[PWA] User dismissed the install prompt");
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
  };

  if (!showInstallButton) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        padding: "16px 24px",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        maxWidth: "90vw",
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>
          Install TallyUp
        </div>
        <div style={{ fontSize: "14px", opacity: 0.9 }}>
          Add to home screen for faster access
        </div>
      </div>
      <button
        onClick={handleInstallClick}
        style={{
          background: "white",
          color: "#667eea",
          border: "none",
          padding: "8px 20px",
          borderRadius: "8px",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "14px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: "transparent",
          color: "white",
          border: "none",
          padding: "8px",
          cursor: "pointer",
          fontSize: "18px",
          opacity: 0.7,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.7";
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// Add CSS animation
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideUp {
      from {
        transform: translateX(-50%) translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
