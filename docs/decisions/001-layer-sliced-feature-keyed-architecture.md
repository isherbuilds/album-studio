# ADR-001: Layer-sliced, feature-keyed architecture

## Status

Accepted

## Date

2026-07-12

## Context

The repository used Feature-Sliced Design directories in the web app while
`packages/core` primarily contained shared Zod schemas. That made a capability
change fan out across vocabulary that did not match the reference architecture
we want to adopt. The project must keep its current runtime stack while making
code composition predictable across the monorepo.

## Decision

Adopt an SFAB-style layer-sliced, feature-keyed architecture. Repeat a capability
key through `db`, `contract`, `core`, `api`, web hooks, components, and routes.
Move cross-package Zod boundaries into `packages/contract`; reserve
`packages/core` for behavior. Replace web `pages`, `features`, `widgets`,
`entities`, and `shared` with `components/<capability>`, `hooks`, `lib`, and
`routes`. Do not ship compatibility barrels for the removed structure.

## Alternatives considered

### Keep FSD and copy only SFAB hooks

Rejected because the same capability would still be split across two competing
taxonomies and future contributors would keep recreating FSD layers.

### Copy the complete SFAB runtime

Rejected because Cloudflare Workers, D1/SQLite, and its Hono client would replace
working stack choices. The composition model is independent of those choices.

### Keep shared schemas in `packages/core`

Rejected because `core` would continue to mean both boundary contract and domain
behavior. A distinct contract package makes dependency direction explicit.

## Consequences

- Capability location is predictable across layers.
- The web app has fewer barrels and pass-through files.
- Imports from the deleted FSD paths are compile failures, intentionally.
- Existing guidance and tooling must teach the new paths.
- The migration is compulsory: the old lint plugin and directories are removed.
