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
