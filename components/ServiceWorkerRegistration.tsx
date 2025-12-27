"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      // Register service worker
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "[PWA] Service Worker registered with scope:",
            registration.scope
          );

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000); // Check every hour

          // Handle service worker updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New service worker available
                  console.log("[PWA] New content available, please refresh.");
                  
                  // Optional: Show a toast notification to user
                  // You can add a custom event or use your toast system here
                  if (window.confirm("New version available! Reload to update?")) {
                    newWorker.postMessage({ type: "SKIP_WAITING" });
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error);
        });

      // Handle controller change (new SW activated)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      // Install prompt handling
      let deferredPrompt: any = null;

      window.addEventListener("beforeinstallprompt", (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        console.log("[PWA] Install prompt available");

        // Optional: Show custom install UI
        // You can dispatch a custom event here to show an install button
        window.dispatchEvent(
          new CustomEvent("pwa-install-available", { detail: e })
        );
      });

      // Log when app is successfully installed
      window.addEventListener("appinstalled", () => {
        console.log("[PWA] App installed successfully");
        deferredPrompt = null;
      });
    }
  }, []);

  return null; // This component doesn't render anything
}
