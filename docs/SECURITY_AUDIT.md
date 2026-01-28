# Security Audit Findings & Recommendations

## Executive Summary

This document captures security findings from a comprehensive audit of the TallyUp codebase conducted January 2026.

**Overall Assessment**: The codebase demonstrates solid foundational security practices, with a few critical items requiring attention before production deployment.

---

## ✅ Security Strengths

### 1. Authentication & Authorization
- **Clerk integration** with Convex provides robust JWT-based authentication
- **Consistent `requireUserId()` pattern** across all 50+ queries/mutations
- **IDOR prevention**: Every resource access validates `userId` ownership

### 2. Input Validation
- **Convex validators** (`v.string()`, `v.number()`, `v.id()`) enforce type safety
- **Server-side validation** for all business logic (amounts, dates, IDs)
- **No raw SQL** - Convex's document model eliminates SQL injection risk

### 3. XSS Prevention
- **React's default escaping** is used throughout
- **No `dangerouslySetInnerHTML`** in application code
- **URL parameters are encoded** (`encodeURIComponent`)

### 4. Environment Security
- `.env*` files properly gitignored
- Secrets remain server-side (Convex environment)
- Only `NEXT_PUBLIC_*` exposed to client

---

## ⚠️ Critical Issues Requiring Attention

### CRITICAL-1: Plaid Access Token Encryption

**Status**: 🔴 HIGH PRIORITY  
**Location**: `convex/schema.ts:1167`, `convex/plaid.ts:283`

**Issue**: Plaid access tokens are stored in plaintext in the database.

**Risk**: If database is compromised, attackers gain:
- Full read access to user bank transactions
- Account balances and personal financial data
- Ability to initiate certain actions on user accounts

**Remediation**:
1. Add encryption module at `lib/crypto.ts` (implemented)
2. Set `ENCRYPTION_KEY` environment variable (32-byte hex)
3. Update `createPlaidItem` to encrypt before storage
4. Update all token retrieval to decrypt

**Implementation**:
```typescript
// In convex/plaidActions.ts - when storing
import { encrypt, decrypt } from "../lib/crypto";

// Store encrypted
accessToken: encrypt(exchangeResponse.data.access_token),

// Retrieve decrypted
const decryptedToken = decrypt(item.accessToken);
```

**Key Generation**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### CRITICAL-2: Knowledge Ingestion Token Validation

**Status**: 🟡 MEDIUM PRIORITY  
**Location**: `convex/coachKnowledge.ts:73-76`

**Issue**: Token comparison uses simple string equality, potentially vulnerable to timing attacks.

**Current Code**:
```typescript
if (expectedToken && args.token !== expectedToken) {
  throw new Error("Invalid ingest token.");
}
```

**Remediation**: Use constant-time comparison:
```typescript
import { timingSafeEqual } from "crypto";

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

if (expectedToken && !secureCompare(args.token ?? "", expectedToken)) {
  throw new Error("Invalid ingest token.");
}
```

---

### CRITICAL-3: Rate Limiting for AI Coach

**Status**: 🟡 MEDIUM PRIORITY  
**Location**: `lib/llm/budgetGuard.ts`, `convex/coach.ts`

**Current State**: Daily caps exist but are disabled by default (0 = unlimited).

**Risk**: Malicious users could:
- Exhaust LLM API budgets rapidly
- Create denial-of-service via expensive operations

**Remediation**:
1. Set sensible defaults (not 0):
```typescript
const DEFAULT_USER_MAX = 50;   // Per user per day
const DEFAULT_GLOBAL_MAX = 5000; // Total across all users
```

2. Add request-level rate limiting for the chat action

---

## 🟡 Moderate Issues

### MOD-1: Internal Mutations Accepting `userId` as Parameter

**Location**: Multiple `internalMutation` handlers in `convex/plaid.ts`

**Issue**: Internal mutations accept `userId` as a trusted parameter from other server functions.

**Risk**: Low (internal functions are not directly callable), but creates trust boundary confusion.

**Recommendation**: Document clearly which functions are "trusted callers only" and consider adding a shared secret for internal calls in high-security deployments.

---

### MOD-2: Verbose Error Messages

**Location**: Various mutation handlers

**Issue**: Some errors leak implementation details:
```typescript
throw new Error("Budget category not found");
```

**Recommendation**: For production, use generic messages for unauthorized access:
```typescript
// Instead of revealing "not found" vs "wrong user"
throw new Error("Access denied");
```

---

### MOD-3: Server Actions Origins

**Location**: `next.config.ts:11-15`

**Current**:
```typescript
allowedOrigins: [
  "localhost:3000",
  "*.app.github.dev",
  "*.githubpreview.dev",
],
```

**Recommendation**: For production, restrict to specific production domains only.

---

## 🟢 Low Priority Improvements

### LOW-1: Content Security Policy (CSP)

Add CSP headers in `next.config.ts` or middleware:
```typescript
// middleware.ts
response.headers.set(
  "Content-Security-Policy",
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
);
```

### LOW-2: Security Headers

Add recommended headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

### LOW-3: Audit Logging

Consider logging security-relevant events:
- Failed authentication attempts
- Plaid token exchanges
- Sensitive data exports
- Admin actions

---

## Compliance Considerations

### For Financial Data (PCI-DSS Adjacent)
- ✅ Access controls in place
- ⚠️ Encryption at rest needed for tokens
- ✅ No direct card data storage (Plaid handles)

### For Personal Data (GDPR/CCPA)
- ✅ User data isolated by userId
- ✅ Soft delete patterns exist
- ⚠️ Consider data export functionality
- ⚠️ Consider data deletion workflow

---

## Action Items Summary

| Priority | Item | Owner | Status |
|----------|------|-------|--------|
| 🔴 HIGH | Encrypt Plaid tokens | - | lib/crypto.ts created |
| 🔴 HIGH | Set ENCRYPTION_KEY env var | - | Pending |
| 🟡 MED | Fix timing attack in token validation | - | Pending |
| 🟡 MED | Enable rate limiting defaults | - | Pending |
| 🟢 LOW | Add security headers | - | Pending |
| 🟢 LOW | Add CSP | - | Pending |

---

## Appendix: Security Testing Checklist

Before production launch:

- [ ] Run `npm audit` and address vulnerabilities
- [ ] Verify ENCRYPTION_KEY is set in production env
- [ ] Test Plaid token encryption/decryption
- [ ] Verify rate limits are active
- [ ] Test all authentication flows
- [ ] Verify no sensitive data in browser console/network
- [ ] Test CSP doesn't break functionality
- [ ] Penetration test by security professional
