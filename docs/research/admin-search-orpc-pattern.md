# Admin search and oRPC pattern

## Question

How should Album Studio implement fast admin search with the smallest code footprint, while using oRPC and avoiding unnecessary React re-renders? How does Midday choose between local and server search?

## Answer

Keep the current Album Studio pattern for the MVP: fetch each bounded admin list once through typed oRPC/TanStack Query options, then perform live search, status filtering, and sorting locally as plain render-time derivations. Do not add URL state, debounce code, pagination, or one request per keystroke yet.

This is the same distinction Midday makes:

- Its bounded product table requests at most 100 products through its RPC client, then enables local table filtering and sorting ([Midday product table, pinned revision](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/products/table.tsx#L29-L59)). Its controlled search field writes directly to the local table column filter on each change ([Midday product header](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/products/header.tsx#L20-L29)).
- Its high-volume invoice table uses URL-backed filters, commits text search on form submit rather than every keystroke, passes the committed filter and sort into an infinite RPC query, and pages by cursor ([invoice URL state](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/hooks/use-invoice-filter-params.ts#L9-L27), [draft-versus-committed input](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/invoice-search-filter.tsx#L72-L86), [infinite RPC query](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/invoices/data-table.tsx#L66-L80)).

Album Studio currently has the first shape, not the second: product and order database queries return complete organization-scoped lists without a cursor or limit (`packages/core/src/product/queries.ts:27-53`, `packages/core/src/order/queries.ts:45-75`). Adding remote text search alone would add contract, router, query-key, and database branches while preserving the full-list request for the empty state. [INFERENCE] That is more code and network work without a measured MVP benefit.

## Evidence

### Album Studio already uses oRPC correctly

- Product lists use `orpc.products.list.queryOptions({ input: { organizationSlug } })` (`apps/web/src/hooks/use-products.ts:18-23`).
- Orders use `orpc.orders.list.queryOptions({ input: { organizationSlug } })` and pass those options directly to `useQuery` (`apps/web/src/hooks/use-orders.ts:19-32`).
- Inventory lists use the equivalent typed oRPC query options (`apps/web/src/hooks/use-inventory.ts:15-22`).
- Members and invitations use oRPC query options (`apps/web/src/hooks/use-organization.ts:34-47`).
- Platform organization lists use oRPC query options (`apps/web/src/hooks/use-platform-admin.ts:21-35`).

This matches oRPC's documented TanStack Query integration: procedure utilities generate `queryOptions`, include typed `input`, and generate input-aware query keys ([oRPC TanStack Query integration](https://orpc.dev/docs/integrations/tanstack-query)). Search/filter input should therefore become part of the oRPC input only when the server owns filtering.

### Current local search is the small-list path

- Products normalize the controlled query once and filter the already-loaded list directly (`apps/web/src/components/products/products-page.tsx:140-160`).
- Orders normalize once, filter by query/status, and sort the filtered rows locally (`apps/web/src/components/orders/orders-page.tsx:49-89`).
- The server is not called on each keystroke; only local component state changes. The cached list remains owned by TanStack Query.

TanStack Query automatically tracks which result properties a component reads and only notifies it when those tracked properties change; object-rest destructuring disables that optimization ([TanStack Query render optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations)). The current pages read `data` directly and do not opt into broad notifications.

### React Compiler should own memoization here

React's compiler documentation shows ordinary derived values and callbacks without manual `useMemo`/`useCallback`; the compiler applies memoization automatically ([React Compiler introduction](https://react.dev/learn/react-compiler/introduction)). Manual memoization also creates a preservation contract that the compiler lint checks ([preserve-manual-memoization](https://react.dev/reference/eslint-plugin-react-hooks/lints/preserve-manual-memoization)). The admin list derivations are therefore intentionally plain expressions rather than thin `useMemo` wrappers.

A controlled live-search input still causes its owning page to render when text changes; that is expected React behavior. The important constraints are that it does not trigger a network request, does not duplicate server state, and does not introduce manually maintained memo dependencies.

## What this means for us

1. Keep the current local search/filter/sort implementation for Products, Orders, Payments, Members, and the platform organization registry.
2. Keep oRPC at the data boundary; do not wrap local string filtering in another RPC call.
3. Keep render-time derivations plain so React Compiler can optimize them. Do not reintroduce `useMemo` solely to silence performance anxiety.
4. Do not add TanStack Table only for search. Midday needs it for column sizing, visibility, selection, virtualization, and large datasets; Album Studio's current tables do not. The manual filter code has the smaller dependency and state surface.
5. When measured data volume requires server search, migrate the whole seam together: typed `q`/filter/sort/cursor/limit contract, indexed database predicates, `orpc.<procedure>.infiniteOptions`, cursor pagination, and a local draft input committed on submit. TanStack Query's documented `placeholderData: keepPreviousData` pattern can keep prior rows visible while a new page/filter loads ([paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)).

[INFERENCE] A practical trigger is sustained typing or table interaction latency, excessive list payload size, or a requirement to search records that are no longer all loaded—not an arbitrary row count.

## Sources

- [Midday product table, commit `5158731`](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/products/table.tsx#L29-L59)
- [Midday product search field, commit `5158731`](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/products/header.tsx#L20-L29)
- [Midday invoice filter state, commit `5158731`](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/hooks/use-invoice-filter-params.ts#L9-L27)
- [Midday invoice search submission, commit `5158731`](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/invoice-search-filter.tsx#L72-L86)
- [Midday invoice infinite query, commit `5158731`](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/invoices/data-table.tsx#L66-L80)
- [oRPC TanStack Query integration](https://orpc.dev/docs/integrations/tanstack-query)
- [TanStack Query render optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations)
- [TanStack Query paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)
- [React Compiler introduction](https://react.dev/learn/react-compiler/introduction)
