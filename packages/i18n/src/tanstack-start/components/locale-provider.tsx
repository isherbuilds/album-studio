import { useLocation } from "@tanstack/react-router";
import * as React from "react";

import { baseLocale, locales } from "#@/paraglide/runtime";

type Locale = (typeof locales)[number];

type LocaleContextValue = {
  locale: Locale;
};

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function getLocaleFromPathname(pathname: string): Locale {
  const segment = pathname.split("/").filter(Boolean)[0];

  if (locales.includes(segment as Locale)) {
    return segment as Locale;
  }

  return baseLocale;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const locale = getLocaleFromPathname(pathname);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo(() => {
    return { locale };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = React.useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }

  return context;
}
