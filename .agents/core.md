# Core package patterns

Use this when adding or refactoring domain behavior in `packages/core`. Shared
Zod boundaries are governed by [Contract package patterns](./contract.md).

## Ownership

`packages/core` owns framework-independent behavior: domain calculations,
transactions, reusable database-backed operations, normalizers, and formatters.
It may depend on `packages/contract` and `packages/db`; it must not depend on
React, TanStack Query, oRPC request context, route state, environment loading, or
web components.

Put code here when it expresses a business rule or operation that should survive
a transport or UI rewrite. Keep one-off transport shaping in the API router and
one-off presentation logic in the web capability.

## Folder shape

```text
packages/core/src/<capability>/
  index.ts
  queries.ts
  commands.ts
  utils.ts
  __tests__/
```

Create only files the capability needs. Inputs shared across packages import
their schema/type from `@tsu-stack/contract/<capability>`. Outbound result types
should normally be inferred from the implementation.

## Rules

- Keep functions deterministic unless their name and signature clearly expose a
  database or other injected dependency.
- Accept dependencies explicitly; do not load environment or create request
  loggers in core.
- Keep SQL/Drizzle persistence details here when they implement reusable domain
  behavior; persistence schema stays in `packages/db`.
- Test public capability exports, not internal helpers.
- Promote API-local queries into core only at a real second call site or when the
  query embodies a business invariant.
- Do not put Zod contract barrels back into core.
