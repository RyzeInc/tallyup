import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security middleware that adds recommended security headers to all responses.
 * 
 * Headers added:
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Legacy XSS protection for older browsers
 * - Referrer-Policy: Controls referrer information sent
 * - Permissions-Policy: Restricts browser features
 * - Strict-Transport-Security: Forces HTTPS (only in production)
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking - deny all framing
  response.headers.set("X-Frame-Options", "DENY");

  // Legacy XSS protection for older browsers
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict browser features we don't need
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // HSTS - only enable in production with HTTPS
  const isProduction = process.env.NODE_ENV === "production";
  const isHttps = request.nextUrl.protocol === "https:";
  
  if (isProduction && isHttps) {
    // 1 year, include subdomains, allow preload list submission
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
    "connect-src 'self' https://*.convex.cloud https://*.clerk.accounts.dev wss://*.convex.cloud https://plaid.com https://*.plaid.com",
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

// Apply middleware to all routes except static assets and API routes that need flexibility
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
