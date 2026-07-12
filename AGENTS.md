# tsu-stack

Opinionated full-stack TypeScript monorepo: TanStack Start + Hono + oRPC + Drizzle + Better Auth + Paraglide.js, powered by Vite Plus.

## Coding Defaults

Respond like smart caveman. Cut all filler, keep technical substance.

- Drop articles (a, an, the), filler (just, really, basically, actually).
- Drop pleasantries.
- No hedging. Fragments fine.
- Technical terms stay exact. Code blocks unchanged.
- Pattern: `[thing] [action] [reason]. [next step].`

- Temporary pre-AI core rule: "Don't worry about backward compatibility of our legacy code. Since this app is not in production I don't care about major refactors. also take decision autonomously where you feel like you have to and complete the entirety of this thing successfully follow dry, kiss and solid principles and remember performance first." Remove this rule after pre-AI phases complete and the core is working solidly.
- Early-phase schema rule: nothing in this codebase is fixed yet. If changing core schema, package boundaries, document model, or existing flows makes future cases simpler or faster, especially by reducing joins, DB queries, or duplicated policy, do the refactor instead of preserving current shape. Major refactors are acceptable before production.
- Keep code simple, direct, and fast. Inline first; extract only when reuse, real policy, independent testing, or readability makes the boundary earn its cost.
- Treat one-off helpers, wrappers, option factories, hooks, providers, contexts, and component abstractions as suspect. Remove or inline them unless they have at least two real call sites or carry non-trivial policy.
- Do not add defensive `try/catch`, fallback defaults, graceful degradation, compatibility redirects, or "just in case" branches to hide uncertainty. Fix root cause or fail loud, especially for auth, tenant scope, money, config, and data integrity.
- Do not catch query/database errors in routers or query helpers to convert them into transport codes. Typed `.errors()` belongs only to router-owned failures that clients must branch on. Query, domain, cursor, and database failures fail fast so root causes stay visible and no duplicate error policy grows across layers.
- Do not bypass TypeScript with `any`, broad casts, non-null assertions, or duplicated local types. Narrow at the source, derive from schemas, or move shared contracts into `packages/core`.
- Prefer fewer layers on hot paths. Avoid extra render state, effects, providers, stores, query wrappers, and memoization unless there is a measured need or a real dependency boundary.
- Use composition patterns only when a reusable component API needs flexibility. For one screen or one call site, prefer plain props, local state, and direct JSX.
- Before handoff, remove AI slop: unnecessary comments, speculative abstraction, unused indirection, broad error handling, and helpers that only rename another call.

Use Vite Plus commands in this repo: `vp` for package/scripts, `vpx` for one-off CLIs.

Common commands:

- `vp run dev` - start dev servers
- `vp check --fix` - package-local format, lint fixes, and typecheck
- `vp run -w fix` - workspace fix after cross-package/root changes
- `vp run build` - build all packages

Before substantial work, run `vpx @tanstack/intent@latest list`; load a matching local skill only when it directly fits the task.

Use the smallest relevant doc set below. Open the most specific file first, then follow links from that file only when the task crosses into another concern.

## Cross-Cutting

- [Architecture](docs/architecture.md): layer map, dependency direction, capability walkthrough, and tenancy invariants.
- [Workflow](.agents/workflow.md): fix cadence, validation scope, build checks, migrations, commits.
- [Vite+ toolchain](.agents/vite-plus.md): `vp`/`vpx`, workspace scripts, package management.
- [Testing](.agents/testing.md): focused unit/e2e coverage and test command scope.
- [Choice flows](.agents/choice-flows.md): native approvals, structured input, human decision points.
- [Logging](.agents/logging.md): durable logs, request logging, redaction, client/server logging.

## Task Entry Points

- UI work: [UI guidelines](.agents/ui.md). Add [TanStack patterns](.agents/tanstack-patterns.md) for routes/loaders/page composition, and [Zustand state management](.agents/zustand.md) for shared client-owned state.
- Shared client state: [Zustand state management](.agents/zustand.md).
- Bugfix: start with the owning domain doc, then [Workflow](.agents/workflow.md). Add [Testing](.agents/testing.md), [Contract package patterns](.agents/contract.md) for shared boundaries, and [Core package patterns](.agents/core.md) for domain behavior.
- Uploads or object storage: [Media storage and uploads](.agents/media-storage.md), plus [Core](.agents/core.md), [oRPC](.agents/orpc.md), and [Environment variables](.agents/environment-variables.md) as needed.
- End-to-end feature: [End-to-end feature workflow](.agents/end-to-end-features.md), then the domain docs it links.

## Domain Docs

- [TanStack patterns](.agents/tanstack-patterns.md): route structure, `beforeLoad`, layouts, route-level preloading, TanStack docs lookup.
- [API fetching patterns](.agents/api-fetching-patterns.md): cohesive capability hooks in `apps/web/src/hooks`.
- [oRPC patterns](.agents/orpc.md): server procedures, router shape, typed errors, request-scoped handler logging.
- [Auth patterns](.agents/auth.md): Better Auth architecture, auth query behavior, protected/guest route rules.
- [i18n guidelines](.agents/i18n.md): copy keys, locale file policy, Paraglide codegen.
- [SEO patterns](.agents/seo.md): route `head()` usage and `@tsu-stack/seo`.
- [Contract package patterns](.agents/contract.md): shared Zod commands, inputs, enums, and boundary types.
- [Core package patterns](.agents/core.md): framework-independent domain behavior and operations.
- [TypeScript conventions](.agents/typescript.md): schema placement, import boundaries, `lib/` vs `utils/`.
- [Environment variables](.agents/environment-variables.md): env scoping, validation, Docker propagation.
