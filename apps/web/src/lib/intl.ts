const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();

function formatterKey(locale: string, options: object | undefined) {
  return `${locale}:${JSON.stringify(options)}`;
}

export function getDateTimeFormatter(locale: string, options?: Intl.DateTimeFormatOptions) {
  const key = formatterKey(locale, options);
  const cached = dateTimeFormatters.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, options);
  dateTimeFormatters.set(key, formatter);
  return formatter;
}

export function getNumberFormatter(locale: string, options?: Intl.NumberFormatOptions) {
  const key = formatterKey(locale, options);
  const cached = numberFormatters.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(locale, options);
  numberFormatters.set(key, formatter);
  return formatter;
}
