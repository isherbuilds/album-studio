# Album Studio architecture

Album Studio uses a layer-sliced, feature-keyed TypeScript monorepo. A capability
keeps the same name as it crosses persistence, boundary contracts, domain logic,
API orchestration, web query policy, components, and routes. The stack remains
TanStack Start, Hono, oRPC, Drizzle/PostgreSQL, Better Auth, React Query,
Paraglide, and Vite Plus.

## Layer map

| Layer            | Location                                 | Owns                                                                      |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| Persistence      | `packages/db/src/schema/<capability>.ts` | Drizzle tables, relations, database client, row types                     |
| Boundary         | `packages/contract/src/<capability>/`    | Pure Zod commands, inputs, enums, and transport-safe shared rules         |
| Domain           | `packages/core/src/<capability>/`        | Framework-independent behavior, transactions, and domain queries          |
| Authentication   | `packages/auth/src/`                     | Better Auth configuration, account lifecycle, organization access control |
| API surface      | `packages/api/src/routers/<capability>/` | oRPC authorization, orchestration, typed errors, explicit outputs         |
| Host             | `apps/server`                            | Thin Hono host for Better Auth, oRPC, OpenAPI, and logging                |
| Web query policy | `apps/web/src/hooks/use-<capability>.ts` | Query options, hooks, mutations, invalidation, UI-safe error policy       |
| Web composition  | `apps/web/src/components/<capability>/`  | Product components, forms, and capability-level layouts                   |
| Navigation       | `apps/web/src/routes/`                   | TanStack route guards, params, preload, metadata, and page assembly       |
| Design system    | `packages/ui`                            | Reusable app-agnostic primitives                                          |

Dependencies point inward. Routes and components may consume hooks and package
surfaces. Hooks may consume API/auth clients and contracts. API routers may
consume auth, contract, core, and db. Contract never imports runtime layers.
Persistence does not import API or web code.

## Capability walkthrough: organization

```text
packages/contract/src/organization/        role and slug contracts
packages/db/src/schema/auth.schema.ts      Better Auth organization tables
packages/auth/src/access-control.ts        shared can(action, { role }) policy
packages/auth/src/index.ts                 Better Auth organization plugin
packages/api/src/routers/organizations/    slug-scoped product surface
apps/web/src/hooks/use-organization.ts     reads, mutations, invalidation
apps/web/src/components/organization/      member and invitation UI
apps/web/src/routes/.../org/                guards, preload, composition
```

The repeated `organization` key is the navigation rule. Do not create generic
`services`, `types`, or `utils` dumping grounds when a capability owns the code.

## Contract and domain boundary

- `packages/contract` owns hand-written inbound validation and shared
  transport-safe enums. Export both each Zod schema and its inferred type.
- `packages/core` owns behavior. It may consume contract and persistence
  surfaces, but it does not own React, transport, environment, or request logic.
- Drizzle owns persisted row shapes. Do not duplicate database rows as Zod
  contracts unless they cross a real input boundary.
- oRPC routers validate input, authorize the request, delegate behavior, and
  translate expected failures into typed errors.

## Web composition

The web app has four stable homes:

```text
apps/web/src/
  components/<capability>/
  hooks/use-<capability>.ts
  lib/
  routes/
```

Routes may compose a small page directly or delegate larger sections to a
capability component. A domain hook starts as one cohesive file containing its
query keys/options, hooks, mutations, and invalidation policy. Split it into a
same-key folder only when distinct read/write policies make the file difficult to
navigate. Do not recreate `pages`, `features`, `widgets`, `entities`, or `shared`.

## Identity and tenancy

- Public signup is disabled.
- Platform Admin creates a missing owner with `auth.api.createUser`, then creates
  the organization with `auth.api.createOrganization` and that `userId`.
- Better Auth owns normal mutations to its User, Account, Organization, Member,
  and Invitation lifecycle. Product-facing oRPC procedures remain the explicit
  Album Studio policy boundary where slug-scoped orchestration is required. The
  one exception is the documented invite-first adapter, which creates a User
  through Better Auth and atomically claims the invitation in a narrow database
  transaction because native acceptance requires an existing session.
- Global Platform Admin does not imply tenant membership.
- The URL organization slug is authoritative for application-domain data. Every
  tenant procedure resolves membership server-side; a resource ID alone never
  grants access.
- UI authorization uses the same `can(action, { role })` vocabulary as server
  middleware, but server checks remain authoritative.
- Organization deletion stays disabled and Better Auth's last-owner protections
  remain in force.

## Adding a capability

Create only the layers the capability needs, in dependency order:

1. persistence schema when data is new;
2. boundary contract for shared input;
3. core behavior and tests;
4. oRPC surface and typed authorization/errors;
5. one web domain hook;
6. capability components;
7. route guard, preload, and composition.

See [ADR-001](decisions/001-layer-sliced-feature-keyed-architecture.md) and
[ADR-002](decisions/002-better-auth-organization-lifecycle.md) for the decisions
behind these boundaries.
