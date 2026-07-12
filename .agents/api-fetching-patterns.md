# API fetching patterns

Use this when adding or refactoring TanStack Query code in `apps/web`.

## Ownership

Keep one cohesive domain facade in `apps/web/src/hooks/use-<capability>.ts`. It
owns that capability's query keys/options, React hooks, mutations, invalidation,
and UI-safe error policy. Components consume the facade; routes import option
factories for preload.

```text
apps/web/src/
  hooks/use-organization.ts
  components/organization/
  routes/.../org/
```

Do not recreate per-operation `api/` folders, pass-through wrappers, or FSD
slices. Start with one file. Split into `hooks/<capability>/` only when distinct
read/write policies make the facade genuinely hard to navigate.

## Query shape

Export query key helpers, an options factory, and a hook from the same facade.

```ts
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";

export const productQueryKeys = {
  bySlug(organizationSlug: string, productSlug: string) {
    return orpc.products.bySlug.key({ input: { organizationSlug, productSlug } });
  }
};

export function getProductQueryOptions(organizationSlug: string, productSlug: string) {
  return orpc.products.bySlug.queryOptions({ input: { organizationSlug, productSlug } });
}

export function useProduct(organizationSlug: string, productSlug: string) {
  return useQuery(getProductQueryOptions(organizationSlug, productSlug));
}
```

Routes call `ensureQueryData(getProductQueryOptions(...))`; components call
`useProduct(...)`. React Query owns caching, not the router loader cache.

## Mutations

- Keep invalidation next to the mutation.
- Invalidate only affected capability keys.
- Use `isDefinedError` for typed oRPC errors.
- Native Better Auth lifecycle mutations may use `authClient.organization`
  directly inside `use-organization.ts`.
- Do not inline oRPC or Better Auth mutation wiring in components.

## Contract imports

Shared input schemas and enums come from `@tsu-stack/contract/<capability>`.
Domain behavior comes from `@tsu-stack/core/<capability>`. Never duplicate a
literal union in the hook when the contract owns it.
