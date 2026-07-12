# Research: adopting SFAB composition without changing the Album Studio stack

Status: decision-ready research

Date: 2026-07-12

SFAB source snapshot: [`sfab-oss/sfab-starter@96ddbed`](https://github.com/sfab-oss/sfab-starter/tree/96ddbed0223824af57bb6a28458c37f9dae738bc)

## Question

Can Album Studio replace its current Feature-Sliced Design (FSD) layout with the
architecture and composition style used by `sfab-oss/sfab-starter`, including its
domain hooks and organization handling, while retaining Album Studio's existing
technology stack?

## Answer

Yes. We should replace FSD with an **SFAB-style layer-sliced, feature-keyed
architecture**, and we can treat the current folder/package layout as disposable.
The target should preserve TanStack Start, Hono, oRPC, Drizzle/PostgreSQL, Better
Auth, React Query, Paraglide, Vite Plus, and the existing product rules. It should
not preserve the current meanings of `packages/core` or `apps/web/src/pages`,
`features`, `widgets`, and `shared`.

The clean target is:

| Layer           | Album Studio target                      | Responsibility                                                              |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Persistence     | `packages/db/src/schema/<capability>.ts` | Drizzle tables, relations, DB client, row types                             |
| Boundary        | `packages/contract/src/<capability>/`    | Pure Zod input/command schemas and transport-safe shared rules              |
| Domain          | `packages/core/src/<capability>/`        | Framework-independent queries, transactions, and business rules             |
| API surface     | `packages/api/src/routers/<capability>/` | oRPC procedures, auth/tenant middleware, typed errors, explicit outputs     |
| Host            | `apps/server`                            | Thin Hono host for Better Auth, oRPC, OpenAPI, logging, and transport setup |
| Web data policy | `apps/web/src/hooks/use-<capability>.ts` | React Query options, hooks, mutations, invalidation, UI-safe error policy   |
| Web composition | `apps/web/src/components/<capability>/`  | Product components and forms built from UI primitives                       |
| Navigation      | `apps/web/src/routes/`                   | TanStack route ownership, search/params, guards, preload, page composition  |
| Design system   | `packages/ui`                            | Reusable primitives only; no product/domain behavior                        |

This is the SFAB composition model translated onto Album Studio's stack. SFAB
itself defines a fixed layer set and repeats the same capability key through every
layer, so finding one capability predicts the rest of its files
([architecture lines 13-28](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/architecture.md#L13-L28),
[lines 30-65](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/architecture.md#L30-L65)).

Organization handling can move substantially closer to SFAB too. Better Auth
1.6.23 already protects the last owner and atomically claims invitations, so
Better Auth—not custom oRPC CRUD—should become the Organization, Membership, and
Invitation lifecycle authority. We should copy SFAB's one domain hook and shared
`can(action, context)` authorization seam, while adapting its public signup,
self-service onboarding, and active-organization scoping to Album Studio's
invite-only, platform-provisioned, URL-slug-authoritative product.

This recommendation intentionally supersedes the current spec decision that raw
Better Auth organization mutations are disabled
(`docs/specs/album-studio-mvp.md:48`). oRPC remains the application-domain surface
for catalog, drafts, orders, inventory, payments, dashboards, and all tenant data;
Better Auth owns the auth-plugin tables and their lifecycle.

## Evidence

### 1. What “SFAB architecture” actually means

SFAB calls its model **layer-sliced, feature-keyed**. Its accepted ADR says a
capability is the same key in `db`, `contract`, `core`, API surfaces, agent tools,
and components, with dependencies pointing toward lower layers
([ADR-001 lines 22-42](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/decisions/001-monorepo-and-architecture.md#L22-L42)).
Its architecture map gives `customer` as a worked cross-layer path and explicitly
states that the repeated key is the main navigation rule
([architecture lines 48-65](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/architecture.md#L48-L65)).

The boundary model is direction-split:

- Drizzle owns persistence/row shapes.
- `contract` owns hand-written inbound Zod commands.
- `core` owns behavior and lets outbound types be inferred.

That is explicit in the architecture map
([lines 67-110](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/architecture.md#L67-L110))
and ADR-004
([lines 26-52](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/decisions/004-schema-sources-and-boundary-types.md#L26-L52)).
The implementation follows that path for catalog products: Zod commands live in
`contract`, database work lives in `core`, and the Hono surface validates then
delegates
([contract](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/packages/contract/src/catalog/products.ts),
[core](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/packages/core/src/catalog/products.ts),
[surface](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hono/org-protected/catalog/products.ts)).

**Inference:** Album Studio's current `packages/core` already behaves more like
SFAB's `contract`, because its only runtime dependency is Zod
(`packages/core/package.json:17-19`). A clean adoption therefore renames/moves
that package to `packages/contract` and creates a new `packages/core` for domain
behavior. Keeping the old package meaning would preserve a vocabulary collision
with the architecture being adopted.

### 2. The stack can remain intact

Album Studio's manifests already establish the desired stack: TanStack Start and
React Query in `apps/web`, Hono and oRPC in `apps/server`, oRPC in `packages/api`,
Better Auth in `packages/auth`, and Drizzle/PostgreSQL in `packages/db`
(`apps/web/package.json:13-40`, `apps/server/package.json:18-32`,
`packages/api/package.json:15-26`, `packages/auth/package.json:11-25`,
`packages/db/package.json:19-34`). None of those choices prevents a
layer-sliced, feature-keyed package graph.

SFAB's “surface” is Hono inside a single Cloudflare Worker
([architecture lines 115-125](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/architecture.md#L115-L125)).
Album Studio should interpret “surface” as its existing `packages/api` oRPC
router and keep `apps/server` as the Hono host. Copying SFAB's Hono RPC client,
single-Worker deployment, D1/SQLite, or Cloudflare environment wiring would be a
stack/runtime migration, which is outside the request.

### 3. The web composition is flatter than FSD

SFAB's web app uses these stable homes:

```text
apps/web/src/
  components/<capability>/
  hooks/use-<capability>.ts
  lib/
  routes/
```

Its `use-organization.ts` keeps the domain's query key, query, mutations, and
invalidation policy together
([source](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hooks/use-organization.ts)).
`use-products.ts` uses the same shape for a non-auth domain
([source](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hooks/use-products.ts)).
Components import those hooks directly, as the organization member table does
([lines 36-66](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/components/organization/members/members-table.tsx#L36-L66)).

SFAB routes are not uniformly “thin wrappers.” For example, the catalog route
contains the page's table/search/pagination composition directly
([source](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/routes/_protected/catalog/index.tsx)),
while the member settings route delegates larger pieces to organization components
([source](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/routes/_protected/settings/members.tsx)).
Therefore, “copy SFAB” means routes may own page composition; it does not mean
every page needs a separate `pages/` layer.

There is one implementation warning: SFAB's `use-documents.ts` is 522 lines and
owns many unrelated mutations
([source](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hooks/use-documents.ts)).
**Inference:** domain hooks should be cohesive, not unbounded. Start with one
`use-<capability>.ts`; split it into a same-key folder only when distinct read,
write, or invalidation policies make the single file difficult to navigate.

SFAB's own architecture document says it is a convergence target, not a claim
that every current file already follows it
([architecture lines 1-10](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/architecture.md#L1-L10)).
The current implementation has useful counterexamples:

- `hooks/` is useful in practice but absent from the canonical layer table
  ([layer table](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/architecture.md#L30-L46)); Album Studio should document it explicitly as web data policy.
- The organization Hono endpoint declares local Zod and queries DB directly,
  bypassing the documented `contract → core` path
  ([source](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hono/protected/organization.ts#L1-L42)); do not copy this exception.
- Some route files are large page implementations, and some forms declare local
  schemas rather than consuming `contract`
  ([catalog route](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/routes/_protected/catalog/index.tsx#L1-L250),
  [invite form](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/components/organization/members/invite-member-form.tsx#L31-L38)). Album Studio should allow route composition without allowing routes or forms to become new business-schema owners.

Album Studio can delete `apps/web/src/pages`, `features`, `widgets`, `entities`,
and `shared`, move product composites under `components`, move provider adapters
under `components/providers` or `lib`, and remove `eslint-plugin-fsd-lint`
(`package.json:39-40`). Because compatibility is explicitly not required, no FSD
shim barrels should be introduced.

### 4. What is good in SFAB's organization handling

SFAB provides a compact domain hook with predictable mutation names and
centralized invalidation. The UI does not repeat Better Auth error unwrapping or
cache policy at each call site
([`use-organization.ts` lines 29-185](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hooks/use-organization.ts#L29-L185)).
That is directly worth adopting: retain native Better Auth calls for lifecycle
operations and add oRPC calls only for Album-specific tenant/domain data.

SFAB also has a strong authorization seam:

- a fixed role set;
- named actions mapped to resource permissions;
- one synchronous `can(action, { role })` function;
- a separate role rank only for ordering decisions;
- shared role labels.

The implementation is in
[`packages/auth/src/access-control.ts` lines 32-167](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/packages/auth/src/access-control.ts#L32-L167).
Its Hono middleware resolves membership server-side before calling that seam
([lines 49-70](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hono/middleware/auth.ts#L49-L70)),
and its UI uses the same function to honestly hide or disable controls
([member table lines 58-66](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/components/organization/members/members-table.tsx#L58-L66),
[invite form lines 49-67](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/components/organization/members/invite-member-form.tsx#L49-L67)).

Better Auth officially supports custom organization roles and permissions, client
organization methods, active-organization state, and organization lifecycle
hooks ([official organization plugin documentation](https://better-auth.com/docs/plugins/organization)).
This confirms that the SFAB seam is built on supported primitives rather than a
private API.

**Recommendation:** copy the structure of `access-control.ts`, but define Album
Studio actions and the fixed `owner | manager | customer` roles. Grant native
organization/member/invitation permissions only to `owner`; grant product-domain
actions according to Album Studio's role matrix. The same `can()` vocabulary can
drive honest UI states and oRPC permission middleware, while every server surface
still resolves the caller's stored membership before authorizing.

### 5. What to copy and what to adapt in SFAB's organization flow

SFAB performs `acceptInvitation`, `rejectInvitation`, `inviteMember`,
`removeMember`, `cancelInvitation`, organization `update`, and organization
`delete` directly through `authClient.organization`
([hook lines 29-185](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hooks/use-organization.ts#L29-L185)).
Its active organization is stored on the session at creation
([auth lines 46-63](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/packages/auth/src/index.ts#L46-L63)),
read by its web hook
([hook lines 9-12](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hooks/use-organization.ts#L9-L12)),
and used as the organization context for protected Hono endpoints
([middleware lines 38-47](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hono/middleware/auth.ts#L38-L47)).

SFAB also exposes public signup
([signup lines 23-57](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/routes/signup.tsx#L23-L57))
and self-service organization creation during onboarding
([onboarding lines 1-37](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/routes/onboarding.tsx#L1-L37)).
Better Auth's own documentation says invitation acceptance is called after the
user is logged in
([official docs, “Accept Invitation”](https://better-auth.com/docs/plugins/organization#accept-invitation)).

Album Studio's product contract is deliberately different:

- invite-only, platform-admin-provisioned organizations;
- `owner | manager | customer`, with different capabilities per organization;
- URL slug as the authoritative organization scope;
- typed oRPC as the product-facing organization orchestration and authorization surface;
- public signup disabled, with missing users created programmatically through Better Auth before Organization or invitation claim orchestration;
- transactionally enforced last-owner protection and audited role changes.

Those requirements are explicit in `docs/specs/album-studio-mvp.md:9-13,
44-55,82,95-103`. However, the installed Better Auth 1.6.23 source shows that its
native member removal rejects removal of the last creator/owner
([source lines 350-381](https://github.com/better-auth/better-auth/blob/9dfceee14021fc15a2fb93023f39635f25b0b5ba/packages/better-auth/src/plugins/organization/routes/crud-members.ts#L350-L381)),
and role updates reject demoting the last owner
([lines 670-680](https://github.com/better-auth/better-auth/blob/9dfceee14021fc15a2fb93023f39635f25b0b5ba/packages/better-auth/src/plugins/organization/routes/crud-members.ts#L670-L680)).
Its invitation acceptance claims `pending → accepted` with a guarded update,
runs membership creation in a transaction, and releases the claim on failure
([invitation source lines 736-855](https://github.com/better-auth/better-auth/blob/9dfceee14021fc15a2fb93023f39635f25b0b5ba/packages/better-auth/src/plugins/organization/routes/crud-invites.ts#L736-L855)).
These are the two hardest lifecycle invariants, and Better Auth already owns them.

There is one real semantic gap. Better Auth invokes `afterRemoveMember` after the
member deletion and invokes `afterUpdateMemberRole` after the role update, outside
the mutation shown in those route bodies
([remove lines 425-453](https://github.com/better-auth/better-auth/blob/9dfceee14021fc15a2fb93023f39635f25b0b5ba/packages/better-auth/src/plugins/organization/routes/crud-members.ts#L425-L453),
[update lines 723-779](https://github.com/better-auth/better-auth/blob/9dfceee14021fc15a2fb93023f39635f25b0b5ba/packages/better-auth/src/plugins/organization/routes/crud-members.ts#L723-L779)).
**Inference:** an audit insert in an organization `after*` hook is durable but not
atomic with the membership write. The implementation spec must either accept
that audit consistency, add a database/outbox mechanism, or retain a custom
transaction only for audited role changes. A silent two-authority mixture is not
acceptable; this must be an explicit decision.

Therefore:

- Keep URL slug + server-resolved organization ID as the authorization boundary.
- Make Better Auth the normal Organization/Membership/Invitation lifecycle path,
  called from the SFAB-style `use-organization.ts` hook.
- Have Platform Admin provisioning call Better Auth's server organization API
  without session headers and with the initial owner's `userId`; the official
  API documents this administrator flow
  ([Better Auth create organization](https://better-auth.com/docs/plugins/organization#create-an-organization)).
- Keep one custom invitation bootstrap seam for a not-yet-authenticated recipient:
  validate the invite, create the account/password, establish a session, then
  call native `acceptInvitation`. Do not reimplement member creation.
- Optionally mirror a validated route selection into Better Auth's
  `activeOrganizationId` for convenience, but never use it alone to authorize an
  Album Studio domain request.
- Do not copy SFAB's public signup, onboarding organization creation, organization
  deletion, or active-organization-only API scoping.

The SFAB invitation UI also contains implementation details that should not be
transplanted:

- the public invitation page fetches invitation detail through a protected Hono
  router, so a signed-out recipient cannot load the intended page
  ([route registration](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hono/protected/index.ts#L13-L22),
  [hook](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hooks/use-organization.ts#L14-L28));
- invitation detail lookup checks only ID in that custom endpoint, not recipient,
  status, or expiry
  ([endpoint](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hono/protected/organization.ts#L27-L40));
- accept/reject errors are swallowed by the component
  ([component lines 31-53](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/components/organization/invitation/accept-invitation.tsx#L31-L53));
- session initialization and the protected guard choose the first membership with
  no ordering or user choice
  ([auth hook](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/packages/auth/src/index.ts#L48-L63),
  [guard](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/routes/_protected.tsx#L31-L45));
- the organization hook invalidates literal React Query keys even though active
  organization state comes from Better Auth's reactive client hooks
  ([hook lines 41-44 and 81-84](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hooks/use-organization.ts#L41-L84)). Album Studio must use the owning Better Auth atom/API or canonical oRPC key rather than assuming those caches are linked.

### 6. Documentation is part of the architecture

SFAB defines a durable knowledge model: a thin `AGENTS.md`, one architecture map,
significant ADRs, code-anchored guides, and on-demand skills
([ADR-005 lines 21-78](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/decisions/005-documentation-and-knowledge-layer.md#L21-L78)).
This is worth adopting along with the code structure, because the current
`.agents/tanstack-patterns.md` and `.agents/api-fetching-patterns.md` explicitly
teach FSD (`.agents/tanstack-patterns.md:18-69`,
`.agents/api-fetching-patterns.md:1-38`). Leaving those documents in place would
cause the deleted architecture to regrow.

SFAB is MIT-licensed and permits copying/modification provided the copyright and
permission notice is retained in substantial copies
([license lines 1-13](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/LICENSE#L1-L13)).
We should adapt its documents to Album Studio rather than copy names, commands,
runtime assumptions, or product claims verbatim, and retain attribution where a
document remains substantially derived.

## What this means for us

### Adopt, adapt, or reject

| SFAB pattern                                     | Decision              | Album Studio form                                                                          |
| ------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------ |
| Layer-sliced, feature-keyed package graph        | Adopt                 | `db → contract → core → api → web`                                                         |
| Separate inbound contract from domain behavior   | Adopt                 | Move current pure Zod `core` to `contract`; create domain `core`                           |
| Role-over-technology package names               | Adopt                 | Keep `api`, `contract`, `core`, `db`, `ui`; no library-named domain packages               |
| `components/<capability>`                        | Adopt                 | Replaces FSD pages/features/widgets/entities                                               |
| `hooks/use-<capability>.ts`                      | Adopt with guardrail  | One cohesive domain data-policy module; split only by same capability when large           |
| Route-owned page composition                     | Adopt                 | Routes own params/search/guards/preload/composition; reusable UI lives in components       |
| One `can(action, context)` seam                  | Adopt                 | Fixed Album roles/actions; same decision vocabulary on server and UI                       |
| Native Better Auth organization reads            | Adopt with adaptation | Pass explicit organization ID/slug; active state is convenience only                       |
| Native Better Auth organization writes           | Adopt with adaptation | Better Auth owns lifecycle; oRPC orchestrates programmatic user creation and tenant policy |
| Active organization as API tenant key            | Reject                | Explicit URL slug resolved to server-side organization ID                                  |
| Public signup/self-service organization creation | Reject                | Invite-only + Platform Admin provisioning                                                  |
| Hono RPC client and in-web Hono surface          | Reject                | Keep oRPC in `packages/api` and Hono host in `apps/server`                                 |
| D1/SQLite/Cloudflare Worker singleton            | Reject                | Keep PostgreSQL and the current deployment/runtime                                         |
| Global DB singleton inside domain functions      | Adapt                 | Pass a DB/transaction dependency so domain operations remain testable and composable       |
| Very large catch-all hook modules                | Reject                | Cohesion threshold; split a capability internally before it becomes a grab bag             |
| Architecture/ADR/guide knowledge model           | Adopt                 | Rewrite docs and AGENTS index for the new structure                                        |

### Target tree

```text
apps/
  server/
    src/                         # thin Hono transport host
  web/
    src/
      components/
        common/
        layout/
        organization/
        catalog/
        orders/
        inventory/
        payments/
      hooks/
        use-organization.ts
        use-catalog.ts
        use-orders.ts
        use-inventory.ts
        use-payments.ts
      lib/                       # clients and cross-cutting adapters, no domain policy
      routes/                    # TanStack routes and page composition
      styles/
packages/
  auth/
    src/access-control.ts        # named actions, roles, labels, rank
  contract/
    src/organization/
    src/catalog/
    src/orders/
    src/inventory/
    src/payments/
  core/
    src/organization/
    src/catalog/
    src/orders/
    src/inventory/
    src/payments/
  db/
    src/schema/<capability>.ts
  api/
    src/routers/<capability>/
  ui/                            # primitives only
```

Cross-cutting packages such as `env`, `i18n`, `logger`, `seo`, and `tsconfig`
remain because they have a genuine role and are not FSD layers.

### Organization vertical slice after the refactor

```text
packages/db/src/schema/auth.ts
packages/contract/src/organization/
packages/core/src/organization/
packages/api/src/routers/organization/       # tenant/domain reads, not BA CRUD duplication
packages/auth/src/access-control.ts
apps/web/src/hooks/use-organization.ts
apps/web/src/components/organization/
apps/web/src/routes/**/org/$organizationSlug/**
```

`use-organization.ts` should copy SFAB's ergonomic surface—short domain verbs,
one invalidation policy, one place for Better Auth error translation. Use Better
Auth for Organization/Membership/Invitation lifecycle and oRPC only for
Album-specific tenant/domain data:

```ts
organizationKeys.bySlug(slug);
organizationKeys.members(slug);
organizationKeys.invitations(slug);
organizationOptions.bySlug(slug);
useOrganizations();
useOrganization(slug);
useOrganizationMembers(slug);
useInviteMember();
useRemoveMember();
useUpdateMemberRole();
useCancelInvitation();
useAcceptInvitation();
```

The exact API should be finalized in a spec, but it should avoid the current
mechanical names such as `useGetOrganizationMembershipQuery` and avoid generic
string keys where Better Auth atoms or oRPC can provide authoritative cache
identity.

### Documentation changes to make with the migration

1. Adapt SFAB's `docs/architecture.md` into Album Studio's canonical architecture
   map, with oRPC and the separate Hono host substituted for SFAB's Worker/Hono
   surface.
2. Add a significant ADR for replacing FSD with layer-sliced, feature-keyed
   composition.
3. Add a significant ADR for the `contract`/`core` direction split.
4. Add or adapt the knowledge-layer ADR and keep `AGENTS.md` as a thin router.
5. Add `docs/guides/adding-a-capability.md` with one Album Studio vertical example.
6. Rewrite `.agents/tanstack-patterns.md`, `.agents/api-fetching-patterns.md`,
   `.agents/core.md`, `.agents/typescript.md`, `.agents/auth.md`, and `.agents/orpc.md`.
7. Remove FSD-specific lint dependencies and all FSD terminology after the last
   import is migrated.
8. Retain the SFAB MIT notice/attribution in substantially adapted documents.

### Recommended migration order

This can be a destructive refactor, but it should still remain runnable by
vertical slice:

1. Lock the target architecture, native Better Auth lifecycle, invitation
   bootstrap, and audit-consistency decision in a spec with test seams; behavior
   compatibility matters even though file compatibility does not.
2. Create `packages/contract`; move the existing pure contracts; create the new
   domain `packages/core`; enforce the package dependency direction.
3. Use organization as the proof slice across DB/contract/core/oRPC/hook/components/routes.
4. Move the remaining web shell into `components/{layout,common,providers}` and
   delete the FSD layer directories rather than leaving compatibility barrels.
5. Move each product capability as a complete vertical slice.
6. Rewrite the architecture and agent docs in the same change that removes FSD.
7. Remove `eslint-plugin-fsd-lint`, obsolete aliases, empty directories, and old
   public barrels.
8. Run focused domain/API tests after each slice, then the workspace fix, unit
   suite, browser journeys, and production build.

The natural next step is `edernal-skills:spec`: turn this decision into an
implementable destructive-migration PRD with the organization slice first and
explicit package, import, test, migration, and documentation seams.

## Sources

### External primary sources

- [`sfab-oss/sfab-starter` at `96ddbed`](https://github.com/sfab-oss/sfab-starter/tree/96ddbed0223824af57bb6a28458c37f9dae738bc)
- [SFAB architecture map](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/architecture.md)
- [SFAB ADR-001: layer-sliced architecture](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/decisions/001-monorepo-and-architecture.md)
- [SFAB ADR-004: boundary types](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/decisions/004-schema-sources-and-boundary-types.md)
- [SFAB ADR-005: documentation and knowledge](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/docs/decisions/005-documentation-and-knowledge-layer.md)
- [SFAB organization hook](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/apps/web/src/hooks/use-organization.ts)
- [SFAB access-control seam](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/packages/auth/src/access-control.ts)
- [Better Auth organization plugin documentation](https://better-auth.com/docs/plugins/organization)
- [Better Auth 1.6.23 member lifecycle source](https://github.com/better-auth/better-auth/blob/9dfceee14021fc15a2fb93023f39635f25b0b5ba/packages/better-auth/src/plugins/organization/routes/crud-members.ts)
- [Better Auth 1.6.23 invitation lifecycle source](https://github.com/better-auth/better-auth/blob/9dfceee14021fc15a2fb93023f39635f25b0b5ba/packages/better-auth/src/plugins/organization/routes/crud-invites.ts)
- [SFAB MIT license](https://github.com/sfab-oss/sfab-starter/blob/96ddbed0223824af57bb6a28458c37f9dae738bc/LICENSE)

### Internal primary sources

- `docs/specs/album-studio-mvp.md:9-13,44-55,67-103`
- `package.json:32-43`
- `apps/web/package.json:13-40`
- `apps/server/package.json:18-32`
- `packages/{api,auth,core,db}/package.json`
- `packages/api/src/lib/procedures/factory.ts:48-99`
- `packages/api/src/routers/organizations/index.ts:54-458`
- `apps/web/src/pages/organization/api/organization.ts:1-131`
- `.agents/{tanstack-patterns,api-fetching-patterns,core,typescript,auth,orpc}.md`

## Not determined

The implementation spec settles the migration policy: public signup remains
disabled; missing users are created programmatically through Better Auth; Better
Auth owns auth-plugin table mutations; oRPC remains the product-facing policy
surface; and the FSD directories are removed without compatibility barrels. The
remaining implementation details are verified slice by slice against
`docs/specs/album-studio-mvp.md`.
