# 006 — Associate product guidance and filter purpose

- **Status**: DONE
- **Commit**: 1f36756
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Rule**: Beyond the scan
- **Estimated scope**: 4 files, small

## Problem

Slug/group-key guidance at `products-page.tsx:131`, `product-editor-page.tsx:153`, and `product-configuration-editor.tsx:563` lacks IDs and `aria-describedby`. Order/product Select triggers at `orders-page.tsx:134` and `products-page.tsx:210` expose only current value, not control purpose.

## Target

Pattern-constrained inputs reference stable description IDs. Filter/sort triggers have localized purpose labels while retaining visible current values.

## Repo conventions to follow

- Use React `useId` for reusable/dynamic descriptions.
- Reuse existing localized status/sort/product copy where possible.

## Steps

1. Add stable description IDs and wire `aria-describedby` on slug/key inputs.
2. Add localized accessible labels to product status, order status, and order sort triggers.
3. Verify names/descriptions through accessibility tree.

## Boundaries

- Do NOT replace Base UI Select semantics.
- Do NOT duplicate visible labels solely for screen readers when `aria-label` suffices.

## Verification

- **Mechanical**: web check and relevant E2E.
- **Behavior check**: accessibility tree announces purpose plus current value and field syntax guidance.
- **Done when**: all cited controls expose complete accessible semantics.
