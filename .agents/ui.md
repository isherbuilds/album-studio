# UI guidelines

Use this when adding or refactoring UI in `apps/web` or reusable primitives in
`packages/ui`.

## Composition

Product UI lives in `apps/web/src/components/<capability>/`. App-wide providers
live in `components/providers`, layouts in `components/layout`, and small
app-specific wrappers in `components/common`. Routes own navigation, guards,
preload, metadata, and page assembly. Query policy stays in `hooks`, never in a
component.

Do not create `pages`, `features`, `widgets`, `entities`, or `shared` directories.
Prefer direct imports over capability barrel files.

## Shared package boundary

- Prefer existing `@tsu-stack/ui/components/*` primitives.
- Move a component into `packages/ui` only when it is reusable, app-agnostic,
  accessible, and free of app routing/auth/env imports.
- Keep router links, locale-aware images, auth-aware controls, and app providers
  in `apps/web/src/components`.
- Inject app-specific link or image implementations into shared primitives rather
  than importing the app from `packages/ui`.
- Use Lucide icons unless an existing brand asset is the better fit.

## Quality floor

Preserve visible keyboard focus, responsive layouts, semantic HTML, reduced
motion, and hover gating. Use the design skill when changing visual direction,
motion, or page layout; a mechanical composition move must preserve the rendered
result in desktop and mobile browser checks.
