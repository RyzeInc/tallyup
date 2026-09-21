import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  turbopack: {
    root: path.resolve(__dirname),
  },

  compiler: {
    // Strip debug logging from production bundles while keeping error/warn,
    // which carry real diagnostics. Avoids hand-editing dozens of call sites
    // and prevents new ones from leaking into production.
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "*.app.github.dev",
        "*.githubpreview.dev",
      ],
    },
  },
};

export default nextConfig;
