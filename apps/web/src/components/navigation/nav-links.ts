import { type LinkProps } from "@tsu-stack/i18n/tanstack-start/components/link";

type NavbarLink =
  | { label: () => string; href: LinkProps["href"]; to?: never }
  | { label: () => string; href?: never; to: LinkProps["to"] };

export const navLinks: NavbarLink[] = [];
