# 002 — Evict deleted product cache safely

- **Status**: DONE
- **Commit**: 1f36756
- **Severity**: MEDIUM
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 2 files, small

## Problem

`apps/web/src/hooks/use-products.ts:156` refreshes lists after deletion but leaves fresh detail data cached. `apps/web/src/routes/{-$locale}/(root-layout)/(auth)/$organizationSlug/admin/products/$productSlug/index.tsx:11` uses `ensureQueryData`, so revisiting within two minutes can render deleted data without a server request.

## Target

Mark removed detail query stale without refetching active editor, and make route loader await a fetch whenever cached detail is stale. Preserve fresh-cache reuse for normal navigation.

## Repo conventions to follow

- Use query option factory from `apps/web/src/hooks/use-products.ts`.
- Keep invalidation policy inside mutation hook.

## Steps

1. In remove success, invalidate exact product detail with `refetchType: "none"` using mutation input slug.
2. Change detail loader from `ensureQueryData` to `fetchQuery` so invalidated data is verified before render.
3. Extend delete E2E to revisit removed URL and verify load failure/no stale editor.

## Boundaries

- Do NOT remove active detail cache before navigation.
- Do NOT broaden invalidation beyond affected organization/product.

## Verification

- **Mechanical**: product E2E and web check pass.
- **Behavior check**: Delete product, revisit previous detail URL, stale editor never renders.
- **Done when**: deletion cannot leave a reusable fresh detail entry.
