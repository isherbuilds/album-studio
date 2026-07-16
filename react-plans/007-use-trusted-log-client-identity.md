# 007 — Use trusted log client identity

- **Status**: DONE
- **Commit**: 1f36756
- **Severity**: MEDIUM
- **Category**: Security
- **Rule**: Beyond the scan
- **Estimated scope**: 2 files, small

## Problem

`apps/server/src/client-log-ingestion.ts:56` trusts caller-controlled forwarding headers. Direct clients can forge Origin and rotate header identities to evade limits, fill tracked-client map, poison logs, and deny telemetry.

## Target

Default identity comes from Node connection remote address through `@hono/node-server/conninfo`. Tests inject deterministic identity. Forwarding headers are not trusted without explicit trusted-proxy policy.

## Repo conventions to follow

- Keep bounded in-memory limiter and exact Origin check.
- Inject clock/client identity only for deterministic tests.

## Steps

1. Read remote address with Node conninfo helper in production middleware.
2. Add optional client-key resolver for unit tests.
3. Test forged forwarding headers cannot rotate identity.

## Boundaries

- Do NOT add distributed infrastructure for MVP.
- Do NOT trust forwarding headers implicitly.

## Verification

- **Mechanical**: server tests and workspace check.
- **Behavior check**: same socket identity hits 429 despite changing forwarding headers.
- **Done when**: untrusted headers cannot choose rate-limit bucket.
