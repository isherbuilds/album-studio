# ADR-003: Store Configuration Draft editor state as one JSONB snapshot

## Status

Accepted

## Date

2026-07-14

## Context

Configuration Draft saves replace Project Name, quantity, selections, step, and
informative evaluation summary together. Current schema splits this atomic editor
state across scalar and JSONB columns even though no query updates, filters, joins,
or indexes those fields independently. Draft identity, tenancy, Product ownership,
lifecycle, timestamps, and optimistic concurrency do require relational behavior.

[Research](../research/configuration-draft-persistence.md) compared browser-native
persistence, a relational envelope with JSONB state, and fully normalized Draft
children.

## Decision

Keep one server-side Configuration Draft row. Store identity, tenant/customer/Product
foreign keys, lifecycle status, revision, and timestamps as relational columns.
Store complete bounded editor state as one typed `snapshot` JSONB document:

```ts
type ConfigurationDraftSnapshot = Pick<
  ConfigurationDraftDetail,
  "projectName" | "quantity" | "selections" | "step" | "evaluationSummary"
>;
```

Replace snapshot atomically. Keep Draft-wide revision compare-and-swap because
separate authenticated contexts can edit same Draft. Keep Product-first locking
around authoritative evaluation; let one conditional `UPDATE ... RETURNING`
perform Draft CAS without a preceding Draft row lock.

## Alternatives considered

### Browser-native canonical Drafts

Rejected. IndexedDB is suitable for optional same-browser offline recovery but
cannot provide reliable cross-context/device server resume, tenant-scoped domain
queries, or future Draft-to-Order conversion without adding synchronization.

### Fully normalized Draft selections and editor fields

Rejected. Current workflow never edits or queries child state independently.
Normalization adds joins, EAV typing, write orchestration, and lock ordering without
a requirement that benefits.

### Existing mixed scalar/JSONB editor columns

Valid but rejected as unnecessary persistence ceremony. Those columns form one
bounded aggregate at every contract and behavior seam.

## Consequences

- API contracts remain flat; persistence parser maps JSONB snapshot to Draft detail.
- Database keeps strong tenant, ownership, Product, lifecycle, and revision constraints.
- Snapshot internals use application schema validation, not per-field SQL checks.
- No JSONB index is added until a measured query requires one.
- Whole-Draft concurrent edits conflict intentionally; independent field merging is
  out of scope.
