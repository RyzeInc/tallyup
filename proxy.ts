import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest, NextResponse as NextResponseType } from "next/server";

/**
 * Edge proxy: authentication + security headers.
 *
 * Auth was previously enforced only by a client component in the root layout,
 * which meant every route was publicly reachable and `auth()` was unavailable
 * on the server. Protection now happens here, before any page renders.
 *
 * Security headers added:
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Legacy XSS protection for older browsers
 * - Referrer-Policy: Controls referrer information sent
 * - Permissions-Policy: Restricts browser features
 * - Strict-Transport-Security: Forces HTTPS (only in production)
 */

/** Marketing, auth screens, and PWA assets stay reachable when signed out. */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/(.*)",
]);

function applySecurityHeaders(request: NextRequest, response: NextResponseType) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  const isProduction = process.env.NODE_ENV === "production";
  const isHttps = request.nextUrl.protocol === "https:";

  if (isProduction && isHttps) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Content Security Policy
  // Note: 'unsafe-inline' and 'unsafe-eval' are needed for Next.js/React
  // In a stricter setup, use nonces for inline scripts
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    // *.convex.site carries Convex HTTP actions, including the coach SSE stream.
    "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://*.clerk.accounts.dev https://plaid.com https://*.plaid.com",
    "frame-src 'self' https://*.clerk.accounts.dev https://cdn.plaid.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  // Only set CSP in production - it can interfere with development tools
  if (isProduction) {
    response.headers.set("Content-Security-Policy", cspDirectives.join("; "));
  }

  return response;
}

export const proxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
  return applySecurityHeaders(request as NextRequest, NextResponse.next());
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
