# 008 — Enforce cookie mutation origin

- **Status**: DONE
- **Commit**: 1f36756
- **Severity**: MEDIUM
- **Category**: Security
- **Rule**: Beyond the scan
- **Estimated scope**: 3 files, small

## Problem

`apps/server/src/index.ts:207` exposes mutation-capable OpenAPI/RPC handlers authenticated by cookies. CORS does not block cross-origin form submission. On deployments with untrusted sibling origins sharing site boundary, SameSite cookies can accompany attacker POSTs.

## Target

Unsafe requests carrying cookies require exact configured web Origin before auth/API handling. Cookie-less API clients remain supported. Better Auth retains its own trusted-origin checks.

## Repo conventions to follow

- Keep policy in focused server middleware with tests.
- Fail with explicit 403; do not catch or degrade.

## Steps

1. Add middleware that checks POST/PUT/PATCH/DELETE requests containing cookies.
2. Require Origin equal to `VITE_WEB_URL` origin; reject missing/mismatched origins.
3. Apply before auth and oRPC/OpenAPI handlers.
4. Test same-origin, mismatched, missing, safe-method, and cookie-less cases.

## Boundaries

- Do NOT block bearer/token clients without cookies.
- Do NOT rely on CORS response headers as CSRF defense.

## Verification

- **Mechanical**: server tests, unit suite, production build.
- **Behavior check**: normal web mutations work; forged cookie POST receives 403.
- **Done when**: cookie-authenticated unsafe requests require exact trusted Origin.
