# TanStack patterns

Use this for TanStack Start routes, guards, params, and React Query preload.

## Route ownership

`apps/web/src/routes` owns navigation state: route paths, params/search
validation, `beforeLoad`, redirects, metadata, and query preload. A small page may
be composed directly in its route. Larger product sections delegate to
`components/<capability>`.

The web structure is:

```text
apps/web/src/
  components/<capability>/
  hooks/use-<capability>.ts
  lib/
  routes/
```

The locale and pathless layout conventions remain:

- `{-$locale}/` — optional locale prefix;
- `(root-layout)/` — navbar/footer shell;
- `(centered-layout)/` — centered public shell;
- `(auth)/` — authenticated guard;
- `(guest)/` — guest-only guard.

## Preload

Use option factories from the capability hook and `ensureQueryData(...)` in
`beforeLoad`. React Query owns caching; `defaultPreloadStaleTime: 0` is
intentional. Route guards protect navigation only—every oRPC/server surface must
authorize independently.

```ts
export const Route = createFileRoute("/.../products/$productSlug/")({
  beforeLoad: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      getProductQueryOptions(params.organizationSlug, params.productSlug)
    ),
  component: ProductPage
});
```

Use `vp run tanstack ... --json` for TanStack documentation lookup and load the
matching Intent skill before changing unfamiliar router behavior.
