# Spec: Album Studio MVP

Status: ready

## Problem

Album Studio's enterprise customer currently sells highly configurable albums, frames, and related products to professional photographers through WhatsApp and phone calls. Customers cannot independently explore valid combinations, see prices change as they configure a product, recover interrupted work, or place a structured order. The business also lacks a consistent boundary between platform administration, organization administration, catalog pricing, stock availability, offline payments, and customer access.

## Solution

Deliver an invite-only, multi-Organization application in which a Platform Admin provisions Organizations and their initial Owners. Owners maintain membership, products, configuration rules, and pricing; Managers operate products, stock, Orders, and offline payments without pricing or membership authority; Customers browse only their Organizations' published catalogs, build resumable configurations with live estimated pricing, and place one configured Product per Order.

The first demonstrable path uses a realistic seeded album. The same generic domain model then powers an Owner product editor within the MVP. Before an Order is placed, the server authoritatively reloads product rules, prices, and component availability. Changed prices require explicit acceptance and unavailable choices block submission. Submitted Orders retain immutable configuration and monetary snapshots. Payments remain offline and component quantities are not automatically reserved or consumed.

## User Stories

1. As a deployment operator, I want an idempotent seed command to create the first Platform Admin so that a fresh installation can be initialized securely.
2. As a Platform Admin, I want to create Organizations and appoint initial Owners so that enterprises can administer themselves.
3. As a Platform Admin, I want installation-wide Organization and role counts so that I can understand adoption without entering Organization operations.
4. As an Organization Owner, I want to invite Customers, Managers, and additional Owners so that I control membership in my Organization.
5. As an invited user, I want to accept an expiring link shared by email or WhatsApp and create my own password so that nobody sends credentials to me.
6. As a user with multiple memberships, I want to select an Organization and use an explicit Organization URL so that I always know which catalog and role are active.
7. As an Owner, I want to create and publish configurable Products so that the catalog reflects what the studio sells.
8. As an Owner, I want to define base prices, option price adjustments, sheet-count pricing, compatibility requirements, and component links so that the configurator matches studio rules.
9. As a Manager, I want to maintain product content, publication, and component stock without changing prices so that shop operations do not require Owner access.
10. As a Customer, I want to see only published Products in an Organization where I have a Customer Membership so that catalogs remain private and isolated.
11. As a Customer, I want incompatible choices to remain visible but disabled with an explanation so that I understand the available product range.
12. As a Customer, I want earlier changes to clear newly invalid later selections and update the estimate so that my configuration stays valid.
13. As a Customer, I want bounded, stepped numeric choices such as sheet count so that construction and pricing constraints are enforced.
14. As a Customer, I want live estimated pricing while I configure so that I understand the effect of each choice.
15. As a Customer, I want to save my current configuration explicitly and checkpoint it when I move between steps so that resumable progress is intentional and visible.
16. As a Customer, I want multiple Drafts for the same Product and an optional Project Name so that I can prepare work for different clients.
17. As a Customer, I want the server to recheck configuration, price, and availability before Order placement so that the submitted amount is authoritative.
18. As a Customer, I want to see the previous and current totals and explicitly accept a changed price so that price fluctuations are transparent.
19. As a Customer, I want an unavailable choice identified and linked to its configurator step so that I can replace it.
20. As a Customer, I want to place an offline-payment Order containing one configured Product and quantity so that the studio receives structured production details.
21. As an Owner or Manager, I want immutable Order configuration and price snapshots so that later catalog changes do not rewrite an agreement.
22. As an Owner or Manager, I want to record partial offline payments and reversals so that deposits and balances are accurate and auditable.
23. As an Owner or Manager, I want to progress and cancel Orders so that the production queue reflects reality.
24. As a Customer, I want to view Orders, duplicate one into a new Draft, and request cancellation while it is placed so that repeat and mistaken orders are manageable.
25. As a Manager, I want to record component stock movements and availability overrides so that checkout reflects shop-floor knowledge.
26. As each actor, I want a small role-appropriate dashboard linked to useful filtered lists so that pending work is visible without analytics complexity.

## Implementation Decisions

### Identity, tenancy, and authorization

- Better Auth owns identity, sessions, active-Organization convenience state, and the normal Organization, Invitation, and Membership lifecycle. Album Studio's typed oRPC procedures remain the product-facing orchestration and authorization surface; normal lifecycle mutations use supported Better Auth APIs. The sole direct-table exception is the documented invite-first adapter, which atomically claims an invitation after Better Auth creates the missing User. The global Admin plugin represents Platform Admin.
- Public sign-up is unavailable. Platform Admin provisioning creates a missing initial Owner programmatically through Better Auth before creating the Organization on that user's behalf. Invite-first account creation for later members also uses Better Auth's server API and never enables the public sign-up endpoint.
- The Platform Admin seed accepts deployment-only name, email, and password inputs, creates the user through Better Auth's server API, and assigns the global `admin` role. Repeated runs leave an existing user unchanged and never reset credentials.
- Only Platform Admin procedures create Organizations and appoint the initial Owner. Existing Owners may invite or appoint additional Owners. Owners may invite Managers and Customers. Managers and Customers have no invitation or membership-management permissions.
- Organization roles are `owner`, `manager`, and `customer`. Better Auth's Organization `admin` and `member` roles are not assigned by Album Studio flows. Staff is not an MVP role.
- Platform Admin does not receive implicit Product or Order access. Organization-domain access always requires Membership, even for a global administrator.
- Every Organization-domain procedure accepts an Organization slug, resolves it server-side, verifies Membership and capability, and scopes every database operation by Organization ID. A resource ID alone never establishes access.
- A user may have different roles in multiple Organizations. A single Membership redirects directly to its Organization; multiple Memberships present a selector. Better Auth's active Organization remembers convenience state, while the URL slug remains authoritative.

### Routes

- Guest routes cover sign-in and invitation acceptance only; public account creation and public catalog routes do not exist.
- Platform routes are `/admin`, `/admin/organizations`, and `/admin/organizations/$organizationSlug`.
- Shared Organization routes are `/org/$organizationSlug`, `/org/$organizationSlug/orders`, and `/org/$organizationSlug/orders/$orderNumber`.
- Owner and Manager operational routes are `/org/$organizationSlug/products`, `/org/$organizationSlug/products/$productSlug`, `/org/$organizationSlug/inventory`, and `/org/$organizationSlug/payments`.
- Owner-only membership management is `/org/$organizationSlug/members`.
- Customer routes are `/org/$organizationSlug/catalog`, `/org/$organizationSlug/catalog/$productSlug`, `/org/$organizationSlug/drafts`, and `/org/$organizationSlug/drafts/$draftId/configure`.
- The Organization home redirects to the role-appropriate dashboard surface. Route files remain thin and use blocking query preloading for protected data.

### Domain and persistence

- The repository uses an SFAB-style layer-sliced, feature-keyed architecture. Shared inbound Zod contracts live in `packages/contract`; framework-independent behavior and database-backed domain operations live in `packages/core`; database schemas remain persistence-only; oRPC procedures own transport orchestration and typed errors; `apps/web/src/hooks` owns query policy; `apps/web/src/components` owns product composition; routes own navigation, guards, preload, and page assembly.
- The former FSD `pages`, `features`, `widgets`, `entities`, and `shared` layers are removed without compatibility barrels. The same capability key repeats across contract, core, API router, web hook, component, and route wherever those layers exist.
- Money is stored and transported as integer minor units with an ISO 4217 currency code. An Organization has one MVP currency. Floating-point money is forbidden.
- Product status is `draft`, `published`, or `archived`. Customers can query only published Products. Owners may permanently delete only Products that have never been referenced by an Order; otherwise they archive them.
- A Product owns at most 100 ordered Option Groups. Group machine keys are at most 80 characters. Group input types are `single`, `boolean`, or `number`. Single and boolean groups own Option Values with immutable IDs of at most 128 characters and per-unit fixed price adjustments, including zero.
- A numeric group owns minimum, maximum, step, included quantity, and per-additional-unit price. Sheet count uses this shape. Values outside the range or step are invalid.
- Option Value requirements express compatibility. Requirements targeting values in the same prerequisite group use OR semantics; requirements across different groups use AND semantics. A value with unmet requirements remains visible but disabled with an explanation.
- Components are Organization-scoped and include a unit, current decimal quantity, low-stock threshold, and availability override of `automatic`, `available`, `low`, or `out`. Under `automatic`, quantity at or below zero is out, quantity at or below the threshold is low, and higher quantity is available. An Option Value may reference multiple Components and a Component may support multiple values; the least-available linked Component controls whether that value can be ordered.
- Inventory Movements are append-only decimal deltas with reason, actor, and timestamp. Component quantity is updated transactionally with a Movement. Checkout uses the effective availability state but does not reserve or deduct material.
- A Configuration Draft belongs to Customer, Organization, and Product. Identity, tenancy, Product ownership, conversion state, revision, and timestamps remain relational. One bounded JSONB document stores latest complete editor snapshot: selections, quantity, Project Name, current step, and last informative evaluation summary. Selections remain keyed by immutable Option Group machine key; entries contain an Option Value ID or numeric value. Labels and ordering may change without changing key/ID identity. Draft persistence is not an event/click log.
- Draft writes use compare-and-swap revision numbers. A stale writer receives `DRAFT_CONFLICT` with the latest safe Draft rather than silent overwrite or automatic merge. Incomplete or invalid configurations remain normal saveable Draft state; Order placement blocks them later.
- Product revision tracks lifecycle and editor concurrency only. It does not participate in configuration evaluation or checkout price acceptance.
- An Order belongs to Customer and Organization, contains one configured Product and quantity, and stores an immutable JSON snapshot of product labels, chosen options, component references, unit adjustments, calculation breakdown, total, and currency. It also stores an immutable generated Order Number and a correctable Project Name.
- Order status is `placed`, `confirmed`, `in_production`, `completed`, or `cancelled`. Cancellation request state is separately `none`, `pending`, `approved`, or `rejected`. A Customer may create one pending request only while `placed`; an Owner or Manager approves or rejects it, and approval moves the Order to `cancelled`. Customers never directly edit submitted Orders.
- Offline Payment records are append-only positive receipts or negative reversals with amount, method, note, actor, and timestamp. A reversal references an earlier receipt. Derived payment state is `unpaid`, `partially_paid`, or `paid`; cumulative receipts may be neither negative nor greater than the Order total unless a future refund or overpayment policy is introduced.
- Audit Events record role changes, pricing changes, Project Name corrections, Order status changes, cancellation decisions, and other privileged mutations not already fully represented by an append-only ledger.

### Configuration and checkout contract

- The primary domain seam is `evaluateConfiguration(input: EvaluateConfigurationInput): ConfigurationEvaluation`.
- `EvaluateConfigurationInput` contains an authoritative Product definition, selected Option Value IDs and numeric values keyed by Option Group key, Order quantity, effective component availability, and currency.
- `ConfigurationEvaluation` is a discriminated result. A valid result contains normalized selections, per-unit breakdown, per-unit total, Order total, currency, and disabled-value explanations. An invalid result contains stable issue codes, affected group keys, human-display parameters, and disabled-value explanations.
- Total calculation is `(base price + fixed option adjustments + numeric additional-unit adjustments) × Order quantity`. Numeric additional units are `max(0, selected - included)` and must respect the configured step.
- The web may run the evaluator against the last public Product definition for immediate feedback. The server always reloads current Product, pricing, requirements, and Component availability and reruns it before submission.
- `catalog.list` returns only lightweight Product summaries and never all Product definitions. `catalog.bySlug` returns one selected Product's complete curated public evaluator/display definition in one response: ordered groups and values, immutable machine identifiers, labels, pricing rules, compatibility requirements, Component references, effective availability statuses, currency, and image URLs. It excludes raw stock quantities, thresholds and overrides, movement history, internal/admin metadata, and image binaries. Images load independently and lazily.
- One complete selected definition supports local evaluation for every step; ordinary Products do not fetch a group per step. Revisit progressive definition loading only after a measured compressed-payload or option-count threshold, not cache assumptions. Server catalog loading uses a fixed query count and no group/value N+1.
- The local evaluator runs immediately on every meaningful Draft change. Draft estimates and saved summaries remain informative; neither locks price or availability.
- Draft estimates are informative and do not lock price. Order placement includes `acceptedOrderTotal` as `Money` (`amountMinor` and `currency`). The server always reloads authoritative data and reevaluates. An invalid current evaluation returns `CONFIGURATION_INVALID`. Only a valid current Order total differing from `acceptedOrderTotal` returns `PRICE_CHANGED`, with previous and current breakdowns plus the current total. Resubmission with the current `acceptedOrderTotal` constitutes explicit acceptance, subject to another fresh server reload and reevaluation.
- Invalid or unavailable server evaluation returns `CONFIGURATION_INVALID` with stable issue codes and affected group keys so the UI can navigate to the first failing step. Unknown resource IDs are not echoed across tenant boundaries.
- Order creation and Draft conversion occur in one database transaction after successful evaluation. A converted Draft cannot create a second Order; idempotency uses the Draft ID and conversion state.

### API and UI contracts

- oRPC exposes cohesive routers for platform administration, Organizations/membership, catalog/products, Drafts, Orders, inventory, payments, and dashboards. Every procedure has explicit Zod input/output and defined expected errors. RPC request bodies share a 256 KiB transport ceiling; this does not impose a global body policy on auth, REST, or future direct-upload surfaces.
- Permission failures use typed `FORBIDDEN`; tenant/resource ambiguity returns `NOT_FOUND` where revealing existence would leak data. Invitation expiry, Draft conflict, configuration invalidity, changed price, invalid status transition, and payment overage have dedicated typed errors.
- Product and Draft queries use slice-local TanStack Query option factories. Mutations invalidate only affected Organization, Product, Draft, Order, inventory, payment, and dashboard keys.
- Draft editing is local and immediately marks the editor dirty. Explicit **Save changes** and every configurator step transition send one full snapshot; the editor is inert while that request is in flight, so no debounce timer, event queue, pending-snapshot queue, or background save exists. Dirty route exits show **Save and leave**, **Discard changes**, and **Keep editing**; browser unload uses the native unsaved-changes warning. Failures keep the local snapshot dirty and expose visible error state. A fresh session resumes the last successfully saved checkpoint.
- `drafts.save` sends the bounded full snapshot plus `expectedRevision`. Server authenticates and scopes Customer, Organization, Draft, and Product; loads current Product and effective availability; evaluates; then stores normalized selections and informative summary with CAS revision. A successful response returns the saved Draft together with the authoritative Product definition used for evaluation, allowing the editor to reconcile without a second request. Draft saving never locks price or availability.
- Active Drafts tied to an unpublished Product remain listed as unavailable and removable by their Customer, while resume and save return `NOT_FOUND` until the Product is published again.
- The configurator is a multi-step form with a persistent price summary on desktop and a bottom summary on mobile. Disabled options explain their prerequisite or stock reason. Price changes show old and new breakdowns before acceptance.
- UI copy remains in Paraglide. MVP catalog content uses the Organization's default language; translated catalog authoring is deferred.
- The Owner product editor edits generic Product, Option Group, Option Value, numeric pricing, requirement, Component link, and publication contracts. Managers may create a draft Product shell and edit non-price content, configuration, Component links, and publication state, but cannot supply or mutate any monetary field. A Manager-created Product cannot publish until an Owner has supplied valid pricing. Manager screens omit and the server rejects all pricing and membership mutations.
- MVP dashboards contain linked summary cards only: Platform Admin sees Organization and role counts; Owner sees Customer counts, Orders by status, unpaid totals, and low/out stock; Manager sees actionable Orders and low/out stock; Customer sees active Drafts and recent Orders.

## Test Seams

### 1. Configuration engine

Unit tests call `evaluateConfiguration` through the core package's public domain export. Table-driven cases verify valid totals, zero-cost options, included and additional sheets, range and step errors, missing required choices, requirement OR/AND semantics, selection invalidation, unavailable Components, quantity boundaries, integer-money arithmetic, and deterministic evaluation output. Order tests verify buyer-outcome total acceptance independently from Draft compare-and-swap revision and Product lifecycle/editor revision. Catalog tests verify lightweight list output, complete curated single-Product output, excluded inventory/admin data, and fixed query count without group/value N+1.

### 2. Authenticated oRPC contracts

Integration tests invoke the app router through authenticated request contexts backed by an isolated local PostgreSQL test database. Fixtures create Platform Admin, Owner, Manager, Customer, multiple Organizations, the seeded Product, Drafts, and Orders. Tests verify Organization scoping, every role boundary, invitation rules, Draft revision conflicts, idempotent conversion, stale-price acceptance, unavailable-component rejection, immutable snapshots, Order transitions, cancellation, Inventory Movements, partial Payments, reversals, and overpayment rejection. Tests assert typed error codes and safe error data rather than implementation details.

### 3. Browser journeys

End-to-end tests in the web app cover only composed critical paths: seeded Platform Admin provisioning and initial Owner assignment; Owner Customer invitation with copyable acceptance link; Customer private catalog access; configuration checkpoint save and resume after a fresh session; live pricing; explicit changed-price acceptance; successful offline Order placement; and unavailable-component navigation back to the affected step. Role-hidden navigation receives a direct-URL authorization check. Browser tests follow the repository's `__e2e__` convention and run through the workspace e2e command.

## Task Plan

- [x] Architecture migration A: Establish the SFAB package boundary
  - Acceptance: `packages/contract` owns shared Zod boundaries, `packages/core` owns behavior and helpers, all consumers import the owning package directly, and the previous core schema exports are removed without compatibility barrels.
  - Verify: focused organization contract test plus package checks for contract, core, API, auth, and web.
  - Depends on: none.

- [x] Architecture migration B: Replace FSD web composition
  - Acceptance: product composition lives under `components/<capability>`, query policy lives under `hooks/use-<capability>.ts`, infrastructure lives under `lib`, routes own page assembly, and `pages`, `features`, `widgets`, `entities`, `shared`, and FSD lint configuration no longer exist.
  - Verify: web package check, route generation, and focused auth/organization tests.
  - Depends on: Architecture migration A.

- [x] Architecture migration C: Make the architecture durable
  - Acceptance: architecture documentation, ADRs, and repository guidance describe the layer-sliced feature-keyed target and no active documentation instructs contributors to create FSD slices.
  - Verify: repository search for stale FSD paths plus workspace formatting/checks.
  - Depends on: Architecture migration B.

- [x] Slice 1: Authoritative configuration engine (riskiest first)
  - Acceptance: A public pure evaluator represents Product groups, values, numeric rules, requirements, component availability, integer-money pricing, issue locations, and deterministic evaluation output; the agreed table-driven cases pass.
  - Verify: `cd packages/core && vp run test:unit` followed by `vp check --fix`.
  - Depends on: none.
  - Interfaces: Produces `evaluateConfiguration(input: EvaluateConfigurationInput): ConfigurationEvaluation` plus exported Zod schemas for Product definitions, selections, issues, price breakdowns, statuses, money, and inventory availability.

- [x] Slice 2: Platform bootstrap and Organization boundary
  - Acceptance: The idempotent seed creates one global Platform Admin without modifying an existing account; public registration is unavailable; Platform Admin programmatically creates a missing initial Owner through Better Auth and creates the Organization through Better Auth with that user as Owner; role-aware slug routes reject missing Membership and cross-Organization access.
  - Verify: focused auth/API integration tests, then `vp run -w fix` and `vp run db:generate`; confirm the generated migration and apply only against a localhost database with `vp run db:migrate`.
  - Depends on: none.
  - Interfaces: Produces `platform.bootstrap`, `platform.dashboard`, `platform.organizations.create`, `platform.organizations.bySlug`, Organization capability middleware, seed command inputs, and explicit Organization route context.

- [x] Slice 3: Owner-controlled invitations and Membership
  - Acceptance: An Owner can create expiring invitations for Owner, Manager, or Customer, copy the acceptance URL, and view/revoke pending invitations; only an Owner can manage Organization membership; Better Auth owns normal invitation and membership mutations and enforces the shared role policy, while oRPC resolves the authoritative slug for product-facing reads and audited orchestration; invite acceptance creates or attaches a User Membership; forbidden roles and expired/reused links fail safely.
  - Verify: focused authenticated oRPC tests and invitation browser journey, then package-local `vp check --fix` in touched packages.
  - Depends on: Slice 2.
  - Interfaces: Consumes Organization capability context; produces `organizations.members.list`, `organizations.invitations.list`, native Better Auth invitation/member mutations in `use-organization.ts`, the invite-first `organizations.invitations.acceptNewUser` adapter, and the invitation-acceptance route contract.

- [x] Slice 4: Seeded private catalog and live configuration
  - Acceptance: A realistic album fixture is seeded through an idempotent demo-data command; Customers see lightweight Product summaries only through valid Membership; selecting one Product loads its complete curated public evaluator/display definition once, with images lazy and independent; all steps evaluate locally without group-per-step fetching; server reads use fixed query count without group/value N+1; configurator handles required choices, sheet count, requirements, disabled explanations, selection clearing, quantity, and live integer-money totals.
  - Verify: core evaluator tests, catalog/API Organization-isolation tests, focused browser configuration journey, and `vp run -w fix`.
  - Depends on: Slice 1 and Slice 2.
  - Interfaces: Consumes core Product/evaluation contracts; produces lightweight `catalog.list`, complete curated `catalog.bySlug` public Product-definition output with effective availability, catalog query factories, and local configurator evaluation/form state keyed by Option Group key.

- [x] Slice 5: Resumable Configuration Drafts
  - Acceptance: Customers can create multiple Drafts for one Product and optionally name them; every meaningful change evaluates locally immediately and marks the editor dirty; explicit Save and every step transition checkpoint one full snapshot while editing is disabled; incomplete/invalid state saves normally; failures keep the local snapshot dirty with visible status; dirty route exits offer Save and leave, Discard, or Keep editing; stale revisions return the latest safe Draft without overwrite or automatic merge; fresh sessions resume the last successful checkpoint.
  - Verify: Draft oRPC contract tests including Organization isolation and revision conflicts, browser checkpoint/resume journey across desktop and mobile, then package-local tests and `vp check --fix`.
  - Depends on: Slice 4.
  - Interfaces: Produces `drafts.list`, `drafts.byId`, `drafts.create`, `drafts.save(full snapshot plus expectedRevision)`, `drafts.remove`, Draft query/mutation factories, and typed `DRAFT_CONFLICT` carrying the latest safe Draft representation. Save scopes Customer/Organization/Draft/Product, reloads current definition and effective availability, evaluates, CAS-writes normalized JSONB selections plus informative summary, and returns the authoritative saved editor payload.

- [ ] Slice 6: Server-reconciled Order placement
  - Acceptance: Checkout checkpoints the current dirty editor snapshot before placement; checkout independently reloads current authoritative data and reevaluates regardless of Draft summary; invalid configuration or availability returns `CONFIGURATION_INVALID` and points to the affected group; only a valid current Order total differing from `acceptedOrderTotal` returns `PRICE_CHANGED` with previous/current breakdowns and current total; resubmission with that current total explicitly accepts it subject to fresh reevaluation; one transaction converts a Draft into exactly one immutable Order; repeated submission is idempotent.
  - Verify: evaluator regression cases, Order oRPC tests for price/stock races and cross-Organization access, successful and failure browser journeys, then `vp run -w fix`.
  - Depends on: Slice 4 and Slice 5.
  - Interfaces: Produces `orders.place({ organizationSlug, draftId, acceptedOrderTotal })`, where `acceptedOrderTotal` is `Money`, typed `PRICE_CHANGED` and `CONFIGURATION_INVALID`, immutable `OrderSnapshot`, `orders.byNumber`, `orders.list`, and Order query keys.

- [ ] Slice 7: Order follow-up and offline payments
  - Acceptance: Owners and Managers progress valid Order states, correct Project Names with audit history, record partial receipts and reversals without overpayment, and approve placed cancellation requests; Customers view, duplicate, and request cancellation but cannot edit submitted Orders.
  - Verify: oRPC state-transition/payment/cancellation contract tests and focused role UI checks, followed by `vp run -w fix`.
  - Depends on: Slice 6.
  - Interfaces: Produces `orders.transition`, `orders.correctProjectName`, `orders.requestCancellation`, `orders.decideCancellation`, `orders.duplicateToDraft`, `payments.listByOrder`, `payments.record`, `payments.reverse`, and shared Order/payment status contracts.

- [ ] Slice 8: Component inventory operations
  - Acceptance: Owners and Managers create/edit Components, append stock Movements, set availability overrides, and see low/out stock; Customers see only derived availability; no Order path reserves or deducts material; every movement updates quantity atomically.
  - Verify: inventory oRPC tests for decimal deltas, effective status, permissions, and Organization isolation; checkout availability regression; then `vp run -w fix`.
  - Depends on: Slice 2 and Slice 6.
  - Interfaces: Produces `inventory.list`, `inventory.componentById`, `inventory.createComponent`, `inventory.editComponent`, `inventory.recordMovement`, `inventory.setAvailability`, and effective availability consumed by the `catalog.bySlug` public definition and `orders.place`.

- [ ] Slice 9: Generic Owner Product editor
  - Acceptance: Owners can create and edit Products, ordered groups, values, numeric rules, requirements, Component links, and prices; preview uses the same evaluator as Customers; publishing rejects incomplete or internally invalid definitions; Managers can create draft shells and edit non-price content, configuration, Component links, and publication state, but every pricing mutation is denied server-side and an unpriced Product cannot publish; referenced Products archive rather than delete.
  - Verify: product-editor oRPC permission and validation tests, evaluator-backed preview tests, focused Owner/Manager browser checks, then `vp run -w fix`.
  - Depends on: Slice 1, Slice 4, and Slice 8.
  - Interfaces: Produces `products.list`, `products.bySlug`, `products.create`, `products.editContent`, `products.editConfiguration`, `products.editPricing`, `products.preview`, `products.publish`, `products.archive`, and `products.remove` with role-specific mutations.

- [ ] Slice 10: Role dashboards and MVP hardening
  - Acceptance: Each role sees only the agreed linked summary cards; direct URLs and API calls enforce the same capabilities; browser journeys cover the three agreed seams; audit events contain no secrets; empty/loading/error states and mobile price summary are reviewable; all migrations, generated routes, checks, tests, and production build pass.
  - Verify: `vp run -w fix`, `vp run test:unit:run`, `vp run test:e2e:run`, and `vp run build`; manually verify migration target is local before `vp run db:migrate`.
  - Depends on: Slice 3, Slice 5, Slice 7, Slice 8, and Slice 9.
  - Interfaces: Produces `dashboards.platform`, `dashboards.owner`, `dashboards.manager`, `dashboards.customer`, final navigation capability mapping, browser fixtures, and the complete MVP acceptance suite.

## Out of Scope

- Staff role and granular Staff permissions.
- Referral links, referral rewards, and self-service Customer acquisition.
- Public registration or unauthenticated catalog browsing.
- Online payment gateways, webhooks, refunds, and payment-provider reconciliation.
- Automatic component reservation, bill-of-materials consumption, and stock deduction from Orders.
- Real-time notes, presence, WebSockets, or server-sent events.
- Share codes or public Draft/configuration sharing.
- Carts or Orders containing multiple differently configured Products.
- Customer editing of submitted Order configuration or Project Name.
- Translated catalog authoring, machine translation, and translation approval workflows.
- Advanced analytics, forecasting, charts, revenue reporting, and inventory planning.
- Automated email delivery as a launch requirement; a configured sender may deliver the same invitation link.
- Public APIs or integrations for external ERPs, accounting systems, or shipping providers.

## Open Questions

None. Exact demo Product labels, option values, compatibility rules, prices, and starting stock are fixture content to collect from the client and do not change the approved architecture.
