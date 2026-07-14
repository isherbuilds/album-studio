import { type ProductDefinition } from "@tsu-stack/contract/configuration";

/** Formats a minor-unit integer amount as localized currency. */
export function formatMinorAmount(amountMinor: number, currency: string, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** fractionDigits);
}

export function parseMajorAmount(value: string, fractionDigits: number, locale: string) {
  const decimal = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  })
    .formatToParts(1.1)
    .find((part) => part.type === "decimal")?.value;
  if (!decimal) throw new Error(`Decimal separator unavailable: ${locale}`);
  const normalized = decimal === "." ? value.trim() : value.trim().replace(decimal, ".");
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return undefined;
  const fraction = match[2] ?? "";
  if (fraction.length > fractionDigits) return undefined;
  const amountMinor = Number(`${match[1]}${fraction.padEnd(fractionDigits, "0")}`);
  return Number.isSafeInteger(amountMinor) && amountMinor > 0 ? amountMinor : undefined;
}

/** Group label by key, falling back to the key when the group is absent. */
export function labelForGroup(groups: ProductDefinition["groups"], groupKey: string): string {
  return groups.find((group) => group.key === groupKey)?.label ?? groupKey;
}

/** Option-value label by group + value id, falling back to the value id. */
export function labelForOption(
  groups: ProductDefinition["groups"],
  groupKey: string,
  optionValueId: string
): string {
  const group = groups.find((item) => item.key === groupKey);
  if (group?.type === "single" || group?.type === "boolean") {
    return group.values.find((value) => value.id === optionValueId)?.label ?? optionValueId;
  }
  return optionValueId;
}
