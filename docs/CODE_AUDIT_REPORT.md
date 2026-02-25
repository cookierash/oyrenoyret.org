# Code Audit Report: oyrenoyret.org

**Date:** 2025-02-22  
**Scope:** Full codebase review for professional engineering, security, maintainability, and minor safety  
**Stack:** Next.js 16, TypeScript, Tailwind, shadcn/ui, PostgreSQL, Server Actions

---

## Executive Summary

The codebase has a solid foundation: modular structure, Zod validation, bcrypt password hashing, DB-backed sessions, and security headers. Several issues were identified that fall into "temporary" or "scaffold" patterns and have been addressed with production-ready fixes.

---

## 1. Security Issues

### 1.1 Login Rate Limit Not Applied (CRITICAL)

**File:** `src/modules/auth/actions/login.ts`  
**Lines:** 19–51  
**Issue:** `checkLoginRateLimit()` exists in `rate-limit.ts` but is never called. Login is vulnerable to brute-force attacks.

**Fix:** Call `checkLoginRateLimit()` at the start of the login action and reject when `allowed: false`.

---

### 1.2 IDOR in `/api/auth/user/[userId]` (HIGH)

**File:** `app/api/auth/user/[userId]/route.ts`  
**Lines:** 10–34  
**Issue:** Unauthenticated endpoint returns user PII (email, firstName, lastName, parentEmail) for any UUID. Enables enumeration and data exfiltration.

**Fix:** Restrict to users with `status: 'INACTIVE'` (registration flow only). Add UUID validation. Return 404 for ACTIVE users. Document that a registration token is the proper long-term fix.

---

### 1.3 Inadequate Input Sanitization (HIGH – XSS)

**File:** `src/security/validation.ts`  
**Lines:** 54–58  
**Issue:** `sanitizeInput()` only trims; no HTML sanitization. User content (materials, discussions, replies) is stored and rendered without sanitization, enabling stored XSS.

**Fix:** Implement HTML sanitization using `isomorphic-dompurify` (server-side). Apply to all user-generated content before storage.

---

### 1.4 CSRF Placeholder Returns False (MEDIUM)

**File:** `src/security/csrf.ts`  
**Lines:** 30–34  
**Issue:** `validateCsrfToken()` always returns `false`. If ever wired in, it would break all state-changing requests. Placeholder is misleading.

**Fix:** Either implement proper CSRF (double-submit cookie or signed token) or remove/deprecate and document that Server Actions rely on SameSite cookies. Next.js Server Actions use POST with SameSite cookies; CSRF risk is reduced but not eliminated for cross-origin scenarios.

---

### 1.5 Global Rate Limiter Placeholder (MEDIUM)

**File:** `src/security/rateLimiter.ts`  
**Lines:** 32–42  
**Issue:** `checkRateLimit()` always returns `allowed: true`. No protection against API abuse.

**Fix:** Implement in-memory rate limiting (or document Redis for production) and wire to sensitive API routes (materials POST, discussions POST, etc.).

---

### 1.6 Error Message Leak in Development (LOW)

**Files:** `app/api/materials/route.ts`, `app/api/materials/[materialId]/route.ts`, `app/api/discussions/route.ts`  
**Issue:** `process.env.NODE_ENV === 'development'` used inline; raw error messages exposed in dev. Inconsistent with centralized env handling.

**Fix:** Use `process.env.NODE_ENV` for error message branching (avoids loading env module at build time). Ensure prod never leaks stack traces or internal errors.

---

### 1.7 Cron Endpoint Without Env Validation (LOW)

**File:** `app/api/cron/archive-discussions/route.ts`  
**Issue:** `CRON_SECRET` is optional. If unset in production, anyone can trigger the cron via GET.

**Fix:** Add `CRON_SECRET` to env schema; require it in production for cron routes.

---

## 2. Code Quality & Professionalism

### 2.1 Magic Numbers for Content Limits

**Files:** `app/api/materials/route.ts`, `app/api/discussions/route.ts`, `app/api/discussions/[id]/replies/route.ts`  
**Issue:** Hard-coded `200`, `300`, `5_000`, `10_000`, `50_000` for title/content limits. Scattered and unmaintainable.

**Fix:** Centralize in `src/config/constants.ts` as `CONTENT_LIMITS`.

---

### 2.2 Consent Version Inconsistency

**File:** `src/modules/auth/actions/registration.ts` line 369  
**Issue:** Uses `'1.0'` while `CONSENT_VERSION` in constants is `'1.0.0'`.

**Fix:** Use `CONSENT_VERSION` from `src/config/constants.ts`.

---

### 2.3 Registration Steps 2–4: userId From Client (MEDIUM)

**File:** `src/modules/auth/actions/registration.ts`  
**Issue:** `userId` is passed from client state. A malicious actor with a victim’s UUID could call `registerParentInfo`, `sendParentVerificationCode`, etc., and complete registration with their own parent email.

**Mitigation:** UUIDs are hard to guess; risk is moderate. Long-term fix: issue a short-lived registration token in step 1, store in httpOnly cookie, and require it for steps 2–4 and for `/api/auth/user`.

---

## 3. Scalability & Sustainability

### 3.1 In-Memory Rate Limit Store

**File:** `src/modules/auth/actions/rate-limit.ts`  
**Issue:** `rateLimitStore` is in-memory. In multi-instance deployments, limits are per-instance, not global.

**Recommendation:** Use Redis (or similar) for distributed rate limiting in production. Document in code.

---

### 3.2 Email Service Not Production-Ready

**File:** `src/modules/auth/services/email.ts`  
**Issue:** Verification codes are only logged in development. No real email sending in production.

**Recommendation:** Integrate Resend, SendGrid, or AWS SES before production. Block deployment if `NODE_ENV=production` and no email provider is configured.

---

## 4. Architecture Consistency

### 4.1 No Middleware for Route Protection

**Issue:** No `middleware.ts` for auth. Each route/action checks `getCurrentSession()` manually. Works but is easy to forget on new routes.

**Recommendation:** Add middleware for protected paths; document pattern for API vs Server Actions.

---

## 5. Readability & Maintainability

### 5.1 Dead or Unused Code

**File:** `app/api/auth/user/[userId]/route.ts`  
**Issue:** No references found in codebase. May be dead or used by external clients.

**Action:** If unused, remove. If used, secure as per 1.2.

---

## 6. Minor Safety (EdTech, Under-18)

- Parental verification and consent flow is implemented.
- PII (email, names) is handled server-side.
- No geolocation, camera, or microphone in Permissions-Policy.
- **Recommendation:** Add data retention policy and age verification if required by jurisdiction.

---

## Summary of Fixes Applied

| # | Issue | Fix |
|---|-------|-----|
| 1 | Login rate limit | Added `checkLoginRateLimit()` to login action |
| 2 | IDOR /api/auth/user | Restrict to INACTIVE users, validate UUID |
| 3 | sanitizeInput | Implement HTML sanitization with isomorphic-dompurify |
| 4 | CSRF placeholder | Document; keep as TODO for future implementation |
| 5 | Content limits | Add CONTENT_LIMITS to constants |
| 6 | Consent version | Use CONSENT_VERSION |
| 7 | Error leak | Use process.env.NODE_ENV (avoids env load at build) |
| 8 | CRON_SECRET | Add to env schema, require in prod |

---

## Remaining Recommendations

1. **CSRF:** Implement double-submit cookie or signed token for state-changing API routes if they are called from non-SameSite origins.
2. **Rate limiting:** Wire global rate limiter to materials/discussions POST; use Redis in production.
3. **Registration token:** Add signed registration token for steps 2–4 to prevent userId tampering.
4. **Email:** Integrate email provider before production launch.
5. **Structured logging:** Replace `console.error` with structured logger (e.g. Pino) for audit and debugging.
