# Configuration Draft persistence

## Question

Should Configuration Drafts live only in browser-native storage, in one server-side
JSONB document, or in fully normalized relational tables? Do full-snapshot saves
need concurrency control?

## Answer

Use one PostgreSQL Draft row with relational identity, tenancy, lifecycle,
revision, and timestamps plus one bounded JSONB editor snapshot. Keep revision
compare-and-swap. Do not add browser persistence or normalized selection rows.

This shape matches actual unit of work: Customer saves and reloads one complete
configuration. PostgreSQL explicitly recommends combining relational and JSON
models and treating a JSON document as atomic when its parts are not modified
independently. Whole-row locking is appropriate because Album Studio already
defines one Draft-wide save and conflict boundary.

## Evidence

### Requirements and current behavior

- MVP requires multiple named server-resumable Drafts, explicit full-snapshot
  saves, fresh authenticated sessions, stale-writer conflicts, and future Order
  conversion by Draft ID
  ([MVP spec](../specs/album-studio-mvp.md)).
- Browser E2E closes one isolated browser context, creates another, signs in again,
  and expects server-saved state to resume
  ([draft-resume.spec.ts](../../apps/web/__e2e__/draft-resume.spec.ts)).
- Wire and UI already treat Project Name, quantity, selections, and step as one
  editor snapshot; server saves all of them together with expected revision
  ([draft contract](../../packages/contract/src/draft/types.ts),
  [Draft page](../../apps/web/src/components/drafts/draft-configurator-page.tsx)).
- Database queries index and filter only relational envelope fields. No query
  filters selections, step, quantity, or evaluation summary independently
  ([Draft schema](../../packages/db/src/schema/draft.schema.ts),
  [Draft queries](../../packages/core/src/draft/queries.ts)).

### Alternative A: browser-native only

IndexedDB supports structured values, indexes, and atomic transactions. Overlapping
read/write transactions are serialized, so it can implement same-browser Draft
records and a local revision check
([IndexedDB transactions](https://www.w3.org/TR/IndexedDB/#transaction-concept),
[transaction scheduling](https://www.w3.org/TR/IndexedDB/#transaction-scheduling)).

Rejected as canonical persistence:

- Browser storage belongs to an origin/storage key, not authenticated account or
  cloud identity. Cross-device resume requires network synchronization; browser
  APIs supply none
  ([Storage model](https://storage.spec.whatwg.org/#model),
  [IndexedDB security](https://www.w3.org/TR/IndexedDB/#security)).
- Storage is best-effort unless persistence permission is granted. Permission can
  be denied, and user action can still clear persistent data
  ([Storage persistence](https://storage.spec.whatwg.org/#persistence),
  [persistence permission](https://storage.spec.whatwg.org/#persistence-permission)).
- `localStorage` is synchronous string storage and HTML warns authors not to assume
  cross-agent locking. Storage events and `BroadcastChannel` notify live same-origin
  contexts but do not provide durable replay or conflict prevention
  ([Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html),
  [BroadcastChannel](https://html.spec.whatwg.org/multipage/web-messaging.html#broadcasting-to-other-browsing-contexts)).

Browser-only persistence would be valid for anonymous, explicitly device-local
scratch work. Album Studio Drafts are authenticated domain records and later become
Orders, so browser-only storage removes required behavior and merely postpones
building server synchronization.

### Alternative B: relational envelope plus one JSONB snapshot

PostgreSQL recommends `jsonb` for most applications, supports predictable JSON
documents alongside relational columns, and states that a JSON document should
represent an atomic datum whose components are not normally updated independently.
It also notes that every JSON update locks the whole row
([JSON types and document design](https://www.postgresql.org/docs/current/datatype-json.html#JSON-DOC-DESIGN)).

Chosen shape:

- Relational: `id`, `organizationId`, `customerId`, `productId`, `status`,
  `revision`, `createdAt`, `updatedAt`.
- JSONB snapshot: `projectName`, `quantity`, `selections`, `step`,
  `evaluationSummary`.
- No GIN index. Draft listing and authorization use B-tree relational fields;
  payload querying has no requirement. PostgreSQL warns broad JSONB indexes record
  every indexed key/value, while targeted expression indexes are smaller
  ([JSONB indexing](https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING)).

Snapshot stays bounded by contract and request-size limits. Application schemas
validate whole document on reads/writes. Foreign keys remain relational because
PostgreSQL constraints own referential integrity
([constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)).

### Alternative C: fully normalized Draft state

Rejected. Separate selection rows would add string/number EAV typing, delete/upsert
or diff orchestration, joins, and lock ordering for a workflow that always sends
one full snapshot. It would also make incomplete and definition-stale selections
harder to retain. No independent selection editing, cross-Draft selection search,
or analytics requirement earns those costs.

### Concurrency

Revision remains necessary. Editing is inert only during one request; separate tabs,
browser contexts, or devices can still save same Draft. PostgreSQL Read Committed
re-evaluates an `UPDATE` predicate after waiting for a concurrent updater, so one
atomic statement can implement Draft-wide CAS:

```sql
UPDATE configuration_draft
SET snapshot = $snapshot, revision = revision + 1
WHERE id = $id AND revision = $expected_revision
RETURNING *;
```

Empty `RETURNING` means stale revision or missing lifecycle row. Reloading latest
scoped Draft distinguishes conflict from not-found
([Read Committed behavior](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED),
[UPDATE RETURNING](https://www.postgresql.org/docs/current/sql-update.html)).

This removes same-Draft pre-locking. Save still locks Product before evaluation so
Product lifecycle/delete cannot race the authoritative snapshot write. Lock order
stays Product then Draft update, matching Product delete then Draft cascade.

## What this means for us

1. Replace five editor-state columns with one typed `snapshot` JSONB column.
2. Keep flat API response/input contracts; persistence parser flattens snapshot.
3. Save via Product-first coherent evaluation plus one revision CAS update.
4. Keep browser state only for unsaved in-memory edits and native unload warning.
5. Reconsider IndexedDB only for explicit offline recovery; reconsider normalized
   children only after independent editing or analytical queries exist.

## Sources

- [PostgreSQL JSON types and document design](https://www.postgresql.org/docs/current/datatype-json.html#JSON-DOC-DESIGN)
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL Read Committed isolation](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)
- [PostgreSQL UPDATE](https://www.postgresql.org/docs/current/sql-update.html)
- [IndexedDB 3.0](https://www.w3.org/TR/IndexedDB/)
- [WHATWG Storage Standard](https://storage.spec.whatwg.org/)
- [WHATWG Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html)
- [WHATWG BroadcastChannel](https://html.spec.whatwg.org/multipage/web-messaging.html#broadcasting-to-other-browsing-contexts)
