import {
  type ProductDefinitionValidationIssue,
  type ProductStatus
} from "@tsu-stack/contract/product";
import { m } from "@tsu-stack/i18n/messages";

/** Localized label and dot tint per product lifecycle status. */
export const productStatusConfig: Record<ProductStatus, { dotClass: string; label: () => string }> =
  {
    archived: { dotClass: "bg-muted-foreground", label: m.products__status_archived },
    draft: { dotClass: "bg-warning", label: m.products__status_draft },
    published: { dotClass: "bg-success", label: m.products__status_published }
  };

/** Maximum fraction digits for a currency in the active locale. */
export function currencyFractionDigits(currency: string, locale: string): number {
  return (
    new Intl.NumberFormat(locale, { currency, style: "currency" }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** Formats a minor-unit integer amount as localized currency. */
export function formatMinor(amountMinor: number, currency: string, locale: string): string {
  const digits = currencyFractionDigits(currency, locale);
  return new Intl.NumberFormat(locale, { currency, style: "currency" }).format(
    amountMinor / 10 ** digits
  );
}

/** Renders a minor-unit amount as an editable major-unit string (e.g. "12.00"). */
export function minorToMajorInput(amountMinor: number, currency: string, locale: string): string {
  const digits = currencyFractionDigits(currency, locale);
  return (amountMinor / 10 ** digits).toFixed(digits);
}

/**
 * Parses a locale-formatted major-unit string into a non-negative minor-unit
 * integer. Returns `undefined` for malformed input or too many fraction digits.
 */
export function parseMoneyMinor(
  value: string,
  currency: string,
  locale: string
): number | undefined {
  const digits = currencyFractionDigits(currency, locale);
  const decimal = new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value;
  if (!decimal) throw new Error(`Decimal separator unavailable: ${locale}`);
  const normalized = (decimal === "." ? value.trim() : value.trim().replace(decimal, ".")).replace(
    /,/g,
    ""
  );
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return undefined;
  const fraction = match[2] ?? "";
  if (fraction.length > digits) return undefined;
  const amountMinor = Number(`${match[1]}${fraction.padEnd(digits, "0")}`);
  return Number.isSafeInteger(amountMinor) && amountMinor >= 0 ? amountMinor : undefined;
}

/** Human-readable path for a product definition validation issue. */
export function formatIssuePath(path: ProductDefinitionValidationIssue["path"]): string {
  return path.map((part) => String(part)).join(" › ");
}

/**
 * Editable labels may be blank while a new row is being authored; fall back to
 * the stable identifier so requirement pickers stay legible. Empty strings are
 * not nullish, so `??` cannot express this.
 */
export function labelOrFallback(label: string, fallback: string): string {
  return label.trim() === "" ? fallback : label;
}
