# 003 — Remove render-time locale mutation

- **Status**: DONE
- **Commit**: 1f36756
- **Severity**: MEDIUM
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 1 file, small

## Problem

`packages/i18n/src/tanstack-start/components/locale-provider.tsx:32` calls `overwriteGetLocale` through `setClientLocale` during render. Aborted concurrent renders can leave Paraglide global state on locale never committed by React.

## Target

Use Paraglide URL strategy as source of truth. Locale switching pushes localized URL; message lookup resolves locale from current URL. Provider only derives context value and updates document `lang` after commit.

## Repo conventions to follow

- Preserve route-driven locale behavior and `localizeUrl` navigation.
- Keep context value memoized.

## Steps

1. Remove module global, `overwriteGetLocale` import, and render-time setter.
2. Remove setter calls from locale switch callback.
3. Verify canonical English and Telugu route hydration and client switching.

## Boundaries

- Do NOT introduce localStorage/cookie locale state.
- Do NOT change locale URL structure.

## Verification

- **Mechanical**: i18n build, web build, catalog E2E.
- **Behavior check**: canonical English routes and `/te` hydrate without mismatch; switcher updates messages and `html[lang]`.
- **Done when**: render is pure and URL remains sole locale authority.
