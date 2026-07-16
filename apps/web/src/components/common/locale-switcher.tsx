import { useLocation } from "@tanstack/react-router";
import { Languages } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { baseLocale, locales } from "@tsu-stack/i18n/runtime";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { type ButtonProps } from "@tsu-stack/ui/components/button";
import { buttonVariants } from "@tsu-stack/ui/components/button";

type LocaleSwitcherProps = {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
};

export function LocaleSwitcher({
  size = "icon",
  variant = "ghost",
  className
}: LocaleSwitcherProps) {
  const currentLocation = useLocation();
  const { locale: currentLocale } = useLocale();
  const nextLocale = locales.find((locale) => locale !== currentLocale) ?? currentLocale;
  const segments = currentLocation.pathname.split("/").filter(Boolean);
  if (locales.includes(segments[0] as (typeof locales)[number])) segments.shift();
  const unlocalizedPath = segments.length === 0 ? "" : `/${segments.join("/")}`;
  const nextPath = nextLocale === baseLocale ? unlocalizedPath : `/${nextLocale}${unlocalizedPath}`;

  return (
    <a
      aria-label={`${m.preferences__switch_language()}: ${m.language_name(undefined, { locale: nextLocale })}`}
      className={buttonVariants({ className, size, variant })}
      href={`${nextPath}${currentLocation.searchStr}${currentLocation.hash}`}
    >
      <Languages aria-hidden size={18} />
    </a>
  );
}
