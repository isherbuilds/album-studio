# 005 — Fix catalog dialog reflow

- **Status**: DONE
- **Commit**: 1f36756
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Rule**: Beyond the scan
- **Estimated scope**: 1 file, small

## Problem

`apps/web/src/components/catalog/catalog-page.tsx:103` uses `overflow-hidden` without viewport max height. At 200–400% zoom, stacked dialog content exceeds viewport and clips project input/action.

## Target

Dialog content has viewport-relative max height and vertical scrolling while preserving desktop two-column layout and image containment.

## Repo conventions to follow

- Imitate scrollable dialog at `apps/web/src/components/products/products-page.tsx:98`.

## Steps

1. Add `max-h-[calc(100dvh-2rem)] overflow-y-auto` to dialog content.
2. Add `min-h-0` to the grid scroll container and ensure image constraints do not force overflow.
3. Verify keyboard access at 400% zoom/mobile viewport.

## Boundaries

- Do NOT remove product image or change submit behavior.

## Verification

- **Mechanical**: web check and catalog E2E.
- **Behavior check**: at 400% zoom, title, field, close, and submit remain reachable.
- **Done when**: no clipped dialog action.
