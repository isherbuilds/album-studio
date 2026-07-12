# ADR-002: Better Auth owns organization lifecycle

## Status

Accepted

## Date

2026-07-12

## Context

Album Studio needs invite-only accounts, Platform Admin provisioning, fixed
organization roles, tenant-safe slug URLs, and last-owner protection. The first
implementation duplicated Better Auth table mutations inside oRPC procedures.
Better Auth 1.6.23 already supplies supported User, Organization, Member, and
Invitation lifecycle APIs and enforces last-owner invariants.

## Decision

Keep public signup disabled. Platform Admin programmatically creates a missing
User through the Better Auth Admin API and then creates the Organization through
the Organization API with that user as owner. Better Auth owns mutations to its
plugin tables. Album Studio keeps oRPC as the product-facing authorization and
orchestration surface for slug-scoped application behavior and keeps a narrow
invite-first adapter where a user must be created before an invitation can be
claimed.

Define `owner`, `manager`, and `customer` once in the contract and share a single
`can(action, { role })` seam between Better Auth role configuration, oRPC
middleware, and honest UI state. The URL slug remains authoritative for tenant
domain access; Better Auth active organization state is convenience only.

## Alternatives considered

### Public signup with membership-only access

Valid as a future migration, but rejected for the current release. Deployment is
invite-only and accounts must be provisioned programmatically.

### Direct writes to Better Auth tables

Rejected for lifecycle operations because they duplicate upstream validation,
transaction handling, invitation claiming, and last-owner protections.

### Make Platform Admin the temporary owner

Rejected because global administration must not grant implicit tenant access.

## Consequences

- Initial provisioning is two idempotent operations: ensure User, then create
  Organization for that user.
- A failed organization create may leave a valid zero-membership user; retry
  reuses it instead of deleting identity data as compensation.
- Existing users are reused by normalized email and their credentials are not
  reset.
- Public signup may be introduced later without changing User or Membership
  storage.
