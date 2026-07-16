# 004 — Centralize money formatting and parsing

- **Status**: DONE
- **Commit**: 1f36756
- **Severity**: MEDIUM
- **Category**: Maintainability & architecture
- **Rule**: Beyond the scan
- **Estimated scope**: 5 files, medium

## Problem

`apps/web/src/components/catalog/format.ts:3` and `apps/web/src/components/products/format.ts:7` independently cache currency formatters and parse localized major amounts with divergent grouping and zero rules. Shared monetary policy can drift.

## Target

One `apps/web/src/lib/money.ts` owns cached formatter, fraction digits, display/input conversion, and localized parsing. Parser accepts explicit minimum minor amount so payments require positive and pricing permits zero.

## Repo conventions to follow

- Extract because formatter/parser policy has multiple real call sites.
- Keep product-status and configuration-label helpers in feature format files.
- Move/extend focused formatter tests.

## Steps

1. Add shared money module with cached formatter and decimal/group separator handling.
2. Replace catalog/order/dashboard/draft and product-pricing imports.
3. Delete duplicated currency code from feature format files.
4. Cover English/Telugu locale formats, grouping, zero, positive-only, precision, and safe-integer overflow.

## Boundaries

- Do NOT use floating-point money outside display/input conversion.
- Do NOT change server integer-minor-unit contracts.

## Verification

- **Mechanical**: focused money tests, unit suite, web check.
- **Behavior check**: displayed prices and payment/pricing submissions remain correct.
- **Done when**: one shared module owns currency semantics.
