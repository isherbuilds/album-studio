# Album Studio admin workspace redesign

## Question

How should Album Studio redesign its role-aware admin workspace—especially Products, the product editor, Orders, Inventory, Payments, Members, and platform administration—so dense operational work becomes faster and easier to understand?

## Answer

Use a **quiet production ledger** rather than a dashboard of forms and cards. Every collection page should have one compact header, one primary action, a searchable/filterable work surface, and rows that carry the information needed to choose the next record. Move creation and infrequent setup into dialogs. Keep detail-page actions beside the record, but reveal complex editing progressively with tabs and accordions.

For Album Studio specifically:

1. **Products:** searchable status view; create in a dialog; each row/card exposes publication, pricing readiness, and revision. The editor becomes a four-step workbench: Details → Options → Pricing → Preview, with readiness and publish controls always visible.
2. **Orders:** table, newest first, with Order/Project, Product, Order date, Status, Quantity, and Total. Add search, status filter, and date/amount sort. Keep mobile access by allowing horizontal overflow rather than deleting columns.
3. **Inventory:** availability summary strip + selectable component ledger. Put “Add component” in a dialog and split the selected component into Movement, Details, and History tabs so the primary stock task is first.
4. **Payments:** use the same order-ledger grammar and route into the existing immutable order/payment detail. Do not fabricate payment-state columns until the list contract exposes ledger summaries.
5. **Members and platform organizations:** tables remain appropriate; move invite/provision forms into dialogs and preserve role-gated controls.
6. **Navigation:** retain the existing role-aware sidebar and group links by operational meaning. Do not introduce a second navigation convention.

## Evidence

### Current codebase

- The authenticated workspace already has a single permission-aware sidebar and mobile sheet. Its links are gated by `can("member.read")`, `can("inventory.manage")`, and `can("product.manage")`; the redesign should preserve this shell rather than replace it (`apps/web/src/components/layout/app-shell.tsx:43-151`, `apps/web/src/components/layout/app-shell.tsx:155-213`).
- The current Products page permanently gives a 22rem column to the creation form, competing with the product list even when the user is not creating anything (`apps/web/src/components/products/products-page.tsx:38-170`).
- The current product editor renders Content, Option groups, Pricing, and Preview as one long stack before a separate validation/action sidebar, which explains the reported noise and 7,000px+ rendered page height (`apps/web/src/components/products/product-editor-page.tsx:295-475`).
- Each option group also expands every value’s identifiers, media, inventory links, and prerequisites at once; progressive disclosure can remove obstacles without removing capabilities (`apps/web/src/components/products/product-configuration-editor.tsx:422-652`).
- Orders are currently stacked list items and omit the available `createdAt` field (`apps/web/src/components/orders/orders-page.tsx:32-95`; `packages/contract/src/order/types.ts:64-73`).
- Inventory already has the right master/detail data model, but the add form precedes the selected inspector and the inspector stacks details, override, movement, and full history (`apps/web/src/components/inventory/inventory-page.tsx:401-515`).
- Permissions are centralized and role-specific: customers can read orders/payments, managers can manage inventory/orders/payments/products, and owners additionally price/delete products and manage members/organization (`packages/auth/src/access-control.ts:8-38`). Any UI simplification must preserve these gates.

### First-party design guidance

- Impeccable’s layout guidance says crowded pages need explicit density, hierarchy, grid, and rhythm decisions; the primary action should be discoverable within two seconds, with related elements grouped tightly and larger spacing between groups ([Impeccable: layout](https://impeccable.style/docs/layout/)).
- Impeccable’s distill guidance says decluttering means combining, hiding what can wait, and consolidating treatments—not deleting needed features. It explicitly recommends moving advanced options behind disclosure ([Impeccable: distill](https://impeccable.style/docs/distill/)).
- Responsive adaptation must preserve critical functionality, use at least 44px touch targets, and collapse dense toolbars/navigation rather than amputate features ([Impeccable: adapt](https://impeccable.style/docs/adapt/)).

### Reference products and source

- Shopify’s official Orders guidance makes search, status/date filters, and saved filter combinations first-class list operations. This supports an order table with a compact query/filter/sort toolbar rather than visual cards ([Shopify Help: viewing and filtering orders](https://help.shopify.com/en/manual/fulfillment/managing-orders/viewing-orders)).
- Shopify’s official Products guidance uses a dense list with search, status filters, sorting, configurable columns, and default status views (All/Active/Draft/Archived). Album Studio only needs the small useful subset—search + status—at current scale ([Shopify Help: searching and filtering products](https://help.shopify.com/en/manual/products/searching-filtering)).
- Midday’s simple order table puts Date, Amount, Status, Product, and Actions in a 45px row and paginates below the table. Its more mature invoice surface adds URL-backed filters, sorting, column controls, and virtualization. Album Studio should adopt the information hierarchy, not the complexity ([Midday order table, pinned source](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/orders/data-table.tsx); [Midday invoice table, pinned source](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/invoices/data-table.tsx); [Midday invoice filter state, pinned source](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/hooks/use-invoice-filter-params.ts)).

### Component-library evaluation

- ReUI advertises URL-persistent filters and advanced data-grid primitives, while Dice UI provides accessible copy-paste data-table/data-grid components ([ReUI filters](https://reui.io/docs/components/base/filters); [Dice UI introduction](https://diceui.com/docs/introduction)).
- **Decision:** do not adopt either data-grid implementation for this redesign. Album Studio’s UI package already standardizes on Base UI/shadcn and does not depend on TanStack Table (`packages/ui/package.json:13-37`). For the current list sizes, existing `Table`, `Input`, `Select`, `Dialog`, `Tabs`, and `Accordion` components cover the required behavior with less code and no second component convention. Revisit a data-grid only when server pagination, bulk selection, column persistence, or virtualization becomes an actual requirement.

## What this means for us

### Shared contract

- Page width: `max-w-7xl`; page padding: 20px mobile / 32px desktop.
- Header: restrained eyebrow, 28–32px title, one-sentence description, one primary action.
- Summary: one bordered strip divided into metrics, not separate floating cards.
- Collection surface: a single bordered table/list with a compact toolbar. Search first; only filters backed by real fields.
- Forms: dialogs for create/invite/provision; tabs for mutually exclusive editing modes; accordions for repeated nested groups.
- Status: semantic Badge + dot; never color alone.
- Mobile: tables scroll horizontally with meaningful minimum width; every action remains available.
- Role behavior: existing route guards and `can(...)` checks remain authoritative.

### Explicit non-goals

- No saved views, bulk actions, virtualized rows, drag-and-drop columns, or server-side query syntax at current data scale.
- No invented customer/payment fields and no backend contract expansion solely for visual parity with Shopify or Midday.
- No ReUI/Dice UI runtime dependency and no parallel design system beside the existing shadcn/Base UI components.

## Sources

- [Impeccable — layout](https://impeccable.style/docs/layout/)
- [Impeccable — distill](https://impeccable.style/docs/distill/)
- [Impeccable — adapt](https://impeccable.style/docs/adapt/)
- [Shopify Help — viewing and filtering orders](https://help.shopify.com/en/manual/fulfillment/managing-orders/viewing-orders)
- [Shopify Help — searching and filtering products](https://help.shopify.com/en/manual/products/searching-filtering)
- [Midday order table, commit `5158731`](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/orders/data-table.tsx)
- [Midday invoice table, commit `5158731`](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/components/tables/invoices/data-table.tsx)
- [Midday URL-backed invoice filters, commit `5158731`](https://github.com/midday-ai/midday/blob/51587319f26a0ffaa9dfccab1920373cb65689b7/apps/dashboard/src/hooks/use-invoice-filter-params.ts)
- [ReUI filters](https://reui.io/docs/components/base/filters)
- [Dice UI introduction](https://diceui.com/docs/introduction)
