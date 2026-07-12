# Research + Decisions: Architecture & code composition (Slice 2/3 rework)

Status: superseded by `docs/research/sfab-architecture-adoption.md` and ADR-002. This file records the earlier Option B analysis; its custom-oRPC lifecycle conclusion is no longer current.
Date: 2026-07-12
Scope: How album-studio composes code from oRPC procedures → frontend, and how the data model is owned. Driven by review of the completed Slice 2 (platform bootstrap) and Slice 3 (invitations/membership), compared against sibling `edernal-books` (same `tsu-stack` base) and `midday-ai/midday`, plus current oRPC/TanStack best practice.

> Saved to `docs/research/` (repo has `docs/specs/` but no prior `docs/research/`; follows research-skill default).
> The `.agents/*.md` convention docs are stock `tsu-stack` boilerplate, not chosen team conventions — treated as non-binding. Decisions below override them; the affected docs get rewritten when implemented.

---

## Question

How do we want to handle architecture — code composition and the data model from backend oRPC to frontend consumption — for the simplest, fastest, slop-free, production-grade result? Back-compat does not matter (pre-production; delete-and-regenerate is fine).

## Answer at the time (superseded)

Keep the good bones (isomorphic oRPC client, explicit Zod in/out, typed errors, React Query) and rework the parts that are ceremony or fragility. **Seven decisions are locked** (below); **one fork is open** — who owns the `organization`/`membership`/`invitation` tables — because it is the only choice that reverses a written spec line. Everything else is implementable regardless of that fork.

---

## Reference findings (cited)

- **album-studio and `edernal-books` are siblings on the same `tsu-stack` base** (TanStack Start + Hono + oRPC + Drizzle + Better Auth + Paraglide), so comparison is exact. `edernal-books/docs/architecture.md:3`.
- **`midday` is a different stack** — `github.com/midday-ai/midday/tree/main/apps/dashboard/src` = flat `actions/app/components/hooks/lib/store/trpc/types/utils`, i.e. **Next.js App Router + tRPC + server actions**. Its concrete patterns (RSC, server actions, `app/`, tRPC) do **not** transfer to TanStack Start + oRPC. `edernal-books` is midday's flat structure already ported to this exact stack, so it — not midday — is the directly applicable reference.
- **Backend gap:** album-studio's `organizationProcedure`/`organizationAdminProcedure` (`packages/api/src/lib/procedures/factory.ts:48-49`) resolve **no** organization; every org handler re-runs `requireOrganizationMembership(...)` by hand (`routers/organizations/index.ts:234,281,355,387,431`). `edernal-books` centralises this in middleware exposing `context.organizationId` (`edernal-books/packages/api/src/lib/procedures/factory.ts:29-73`) with the reader in `packages/db/src/queries/organizations.ts:58`. oRPC docs + community starters endorse builder-level middleware over per-handler setup.
- **Schema smell:** `packages/db/src/schema/auth.schema.ts` is a Better Auth CLI file (`auth:generate`) hand-edited with app indexes/checks on `member`/`invitation` (`:117-152`), the app-only `audit_event` table (`:155-172`), and the `relations` block. `edernal-books` keeps `auth.schema.ts` pure and splits app tables into `audit.ts`, `organization.ts`, `outbox.ts` + one `relations.ts`.
- **Fresh-session cost:** unstaged change routes all org-admin procedures (incl. GET reads) through `freshProtectedProcedure` → `getSession({ disableCookieCache: true })` per call (`factory.ts:29-49`, `create-context.ts`). Org roles come from our DB, so this cookie-cache workaround is unnecessary for org scope.
- **Invitation fragility is narrow:** the claim tx itself is clean (`FOR UPDATE`, `routers/organizations/index.ts:91-135`). The fragile part is `acceptNewUser` creating the user via BA **outside** the tx, then a compensating `db.delete(user)` on failure (`:158-219`). Token = invitation PK (random UUID, so not enumerable, but secret is coupled to PK) via `getInvitationUrl(id)`.
- **Frontend ceremony:** album-studio's `.agents/api-fetching-patterns.md` mandates slice-local `api/*.query.ts`/`*.mutation.ts` + option-factory + key object + hook wrapper + barrel per operation → 8 tiny pass-through files for the members screen. `edernal-books` inlines `orpc.queryOptions()` and keeps one hook per domain, treating one-off wrappers as suspect. Both FSD and flat are legitimate per the web literature; the slop is the per-operation granularity, not the layer taxonomy.
- **Blast radius of dropping the BA org plugin is small:** grep shows only `getSession` (identity) and `createUser` (admin plugin) are load-bearing; the `organization()` plugin is configured once and used purely as storage; **nothing reads `activeOrganizationId`** and no BA org APIs are called.

## Locked decisions (implement regardless of the fork)

1. **oRPC context = `{ db, authSession, headers }`.** Put the Drizzle client in context (testable, tx-friendly) instead of importing the `db` singleton in routers; rename `session`→`authSession`; **drop `getFreshSession`** from context. Fresh-session check stays only inside platform-admin middleware.
2. **Org-scoping middleware procedures.** `organizationProcedure(inputSchema)` + `organizationRoleProcedure(inputSchema, roles)` resolve membership once, expose `context.organizationId`/`context.role`. Delete the ~10 manual `requireOrganizationMembership` calls and the misnamed aliases. Typed errors declared at builder level.
3. **Fail-fast; no try/catch or error wrappers.** Delete `lib/db-errors.ts` and every `isUniqueViolation` catch. Use `onConflictDoNothing` + explicit in-tx pre-checks that throw typed errors only where the client must branch (slug-taken, already-member). Unexpected failures bubble to the global handler.
4. **Invitation seam fix.** Idempotent claim (re-accept attaches membership; no compensating `db.delete(user)`). Decouple secret token from PK (store `tokenHash`; URL carries the secret). Keep the clean `FOR UPDATE` claim tx.
5. **`audit_event` → `audit.schema.ts`; `relations` → `relations.ts`.**
6. **Naming.** Kill `listMine`; plain verbs under domain routers (`memberships.list`, `invitations.create`, `members.remove`, …).
7. **Lean frontend oRPC.** Drop per-operation files + mandatory factory/keys/barrel. Inline `orpc.<p>.queryOptions()` in routes and simple reads; one hook per domain only when it owns invalidation/optimistic/policy; typed errors via `isDefinedError`.

## Open fork — org-table ownership (needs sign-off; reverses `docs/specs/album-studio-mvp.md:48`)

Better Auth's CLI can only emit plugin-default columns — it cannot express the unique/partial-unique indexes, check constraints, or uuidv7 ids the app needs on `member`/`invitation`. So those constraints can live _only_ by hand-editing the generated file **or** by owning the tables. No config-only path exists.

- **Option A (recommended): app owns the org domain.** Drop the BA organization plugin; define app-owned `organization`/`membership`/`organization_invitation` in `organization.schema.ts` (uuidv7, proper indexes/checks, clean names), `references(() => user.id)` still pointing at BA identity. `auth.schema.ts` becomes pure BA (user/session/account/verification) → regeneratable, never hand-edited. Keeps admin plugin (platform admin + `createUser`). Uniform with slices 4-10 tables. Reverses spec line 48 (update the spec). Loses BA org APIs (already unused).
- **Option B: keep the BA org plugin.** Honors spec line 48; move audit + relations out; but custom indexes/checks on `member`/`invitation` **must** stay hand-added in the generated `auth.schema.ts` (the disliked edit persists), token can't cleanly decouple from PK, names stay BA's.

Full side-by-side and code sketches were delivered in-conversation on 2026-07-12.

## Next step

On A/B sign-off: implement foundation-first — (schema split + core contracts) → (context + procedures + queries) → (platform & organizations routers) → (Slice 2/3 web rework) → (rewrite `organizations.test.ts`/`platform.test.ts`, `vp run -w fix`, `vp run db:generate`, apply migration against localhost only). Then rewrite the affected `.agents/*.md` so the new conventions are enforced.

## Sources

- album-studio: `.agents/{tanstack-patterns,api-fetching-patterns,orpc}.md`; `packages/api/src/lib/procedures/factory.ts`, `lib/context/{types.ts,hono/create-context.ts}`, `routers/{organizations,platform}/index.ts`, `routers/organizations/{access.ts,invitation-url.ts}`, `client/tanstack-start/orpc.ts`; `packages/db/src/schema/{auth.schema.ts,index.ts}`; `packages/auth/src/index.ts`; `apps/web/src/pages/organization/**`; `docs/specs/album-studio-mvp.md:48`.
- edernal-books: `.agents/{orpc,backend-architecture,api-fetching-patterns,tanstack-patterns}.md`; `docs/architecture.md`; `docs/decisions/0011-fail-fast-query-errors.md`; `packages/api/src/lib/procedures/factory.ts`, `routers/organizations/index.ts`; `packages/db/src/schema/{auth.schema.ts,audit.ts}`, `packages/db/src/queries/organizations.ts`; `apps/web/src/hooks/use-organizations.ts`.
- midday: `github.com/midday-ai/midday/tree/main/apps/dashboard/src`.
- web: orpc.dev docs (TanStack Query, SSR, from-tRPC, TanStack Start adapter); middleapi/orpc Discussion #1387; feature-sliced.design/blog; TanStack/query Discussions #8547, #7820.

---

## Superseded addendum (2026-07-12): Native Better Auth org functions vs custom oRPC

This addendum predates the later source review captured in
`docs/research/sfab-architecture-adoption.md`. ADR-002 now governs: native Better
Auth APIs own normal organization lifecycle operations, while Album Studio keeps
only the invite-first account-creation adapter and audited role-update orchestration.

**Question.** Why not use Better Auth's native organization functions on the client (like `sfab-oss/sfab-starter`) instead of custom oRPC procedures?

**Answer.** Because album-studio deliberately disabled them and its org model diverges from Better Auth's defaults. Concretely, in `packages/auth/src/index.ts` the org roles are created with EMPTY access-control statements (`newRole({})`), so every native mutation (`inviteMember`, `removeMember`, `acceptInvitation`, `update`, `delete`) returns FORBIDDEN — this is how spec line 48 ("raw Better Auth Organization mutation permissions are disabled") is enforced.

**Evidence — sfab-starter (native model).** `apps/web/src/hooks/use-organization.ts` calls `authClient.organization.acceptInvitation/inviteMember/removeMember/cancelInvitation/update/delete` directly from the client, reads `authClient.useSession().session.activeOrganizationId`, and uses BA default roles `member|admin|owner`. Near-zero backend org code — its product IS Better Auth's org model.

**Why album diverges (each point defeats a native function):**

- Roles `owner|manager|customer` with domain rules (manager cannot touch pricing; customer sees only published catalog) — not BA's `member|admin|owner`.
- Orgs are Platform-Admin-provisioned (`allowUserToCreateOrganization: false`), initial owner appointed — native `create`/`delete` are disabled by design.
- Invariants run in one server transaction: last-owner protection, `audit_event` on role change, idempotent membership — native mutations run BA's logic only.
- Invite = copyable WhatsApp link + account-creation-with-password at acceptance (`invitations.acceptNewUser`) — BA's `acceptInvitation` assumes an already-authenticated user and email delivery.
- One server-authoritative, URL-slug-scoped, typed oRPC surface (Zod in/out, typed errors, OpenAPI); the client never drives membership.

**Where native would still be fine (no invariant):** reading active org from session (`session.activeOrganizationId`) or `authClient.useListOrganizations()`. album intentionally chose URL slug as authoritative (spec line 55) and dropped these, so adopting native there saves little. Verdict: custom oRPC is correct for the lifecycle mutations; native is only viable for invariant-free conveniences album already declined.

**Sources (addendum):** `github.com/sfab-oss/sfab-starter` `apps/web/src/hooks/use-organization.ts`; album `packages/auth/src/index.ts`; `docs/specs/album-studio-mvp.md:48,55`.
