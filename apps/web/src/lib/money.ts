const currencyFormatters = new Map<string, Intl.NumberFormat>();
const numericSeparators = new Map<string, { decimal: string; group?: string }>();

function getCurrencyFormatter(currency: string, locale: string) {
  const key = `${locale}\u0000${currency}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { currency, style: "currency" });
    currencyFormatters.set(key, formatter);
  }
  return formatter;
}

export function currencyFractionDigits(currency: string, locale: string): number {
  return getCurrencyFormatter(currency, locale).resolvedOptions().maximumFractionDigits ?? 2;
}

export function formatMinorAmount(amountMinor: number, currency: string, locale: string): string {
  const digits = currencyFractionDigits(currency, locale);
  return getCurrencyFormatter(currency, locale).format(amountMinor / 10 ** digits);
}

export function minorToMajorInput(amountMinor: number, currency: string, locale: string): string {
  const digits = currencyFractionDigits(currency, locale);
  return (amountMinor / 10 ** digits).toFixed(digits);
}

function getNumericSeparators(locale: string) {
  const cached = numericSeparators.get(locale);
  if (cached) return cached;

  const parts = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    useGrouping: true
  }).formatToParts(12_345.6);
  const decimal = parts.find((part) => part.type === "decimal")?.value;
  if (!decimal) throw new Error(`Decimal separator unavailable: ${locale}`);
  const separators = {
    decimal,
    group: parts.find((part) => part.type === "group")?.value
  };
  numericSeparators.set(locale, separators);
  return separators;
}

export function parseMajorAmount(
  value: string,
  currency: string,
  locale: string,
  { minimumMinor = 0 }: { minimumMinor?: number } = {}
): number | undefined {
  const digits = currencyFractionDigits(currency, locale);
  const { decimal, group } = getNumericSeparators(locale);

  const ungrouped = group ? value.trim().split(group).join("") : value.trim();
  const normalized = decimal === "." ? ungrouped : ungrouped.replace(decimal, ".");
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return undefined;
  const fraction = match[2] ?? "";
  if (fraction.length > digits) return undefined;
  const amountMinor = Number(`${match[1]}${fraction.padEnd(digits, "0")}`);
  return Number.isSafeInteger(amountMinor) && amountMinor >= minimumMinor ? amountMinor : undefined;
}
