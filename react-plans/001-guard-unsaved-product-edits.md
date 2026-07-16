# 001 — Guard unsaved product edits

- **Status**: DONE
- **Commit**: 1f36756
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 4 files, medium

## Problem

`apps/web/src/components/products/product-editor-page.tsx:91`, `product-configuration-editor.tsx:399`, and `product-pricing-form.tsx:128` own independent editor state. Parent navigation and lifecycle actions at `product-editor-page.tsx:359` cannot see dirty children. Back navigation loses edits; publish/archive/delete can act on persisted state while unsaved controls remain visible.

## Target

Each child reports dirty state to parent. Parent blocks route navigation while any section is dirty and disables lifecycle mutations until edits are saved or discarded. Pricing form clears dirty state only after successful save.

## Repo conventions to follow

- Imitate `apps/web/src/components/drafts/draft-configurator-page.tsx:188` for `useBlocker` and leave dialog behavior.
- Keep mutation ownership in `apps/web/src/hooks/use-products.ts`.
- Keep section state local; lift only aggregate dirty policy.

## Steps

1. Add `onDirtyChange` callbacks to content, configuration, and pricing editors.
2. Track section dirty flags in `ProductEditorPage` and derive one `hasUnsavedChanges` value.
3. Block route navigation and show explicit keep-editing/discard actions.
4. Disable publish/archive/delete while dirty and expose reason in nearby status copy.
5. Extend product editor E2E to verify navigation guard and successful save clearing.

## Boundaries

- Do NOT move all form state into parent.
- Do NOT auto-save or silently discard.
- Do NOT change product API contracts.

## Verification

- **Mechanical**: `vp check --fix`, focused product E2E, React Doctor changed-scope scan.
- **Behavior check**: Edit each tab, switch tabs without state loss, attempt Back and see prompt, save and navigate without prompt, lifecycle actions remain unavailable while dirty.
- **Done when**: all three editor sections participate in one navigation/lifecycle guard.
