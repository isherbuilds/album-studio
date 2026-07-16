import { Suspense } from "react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { buttonVariants } from "@tsu-stack/ui/components/button";
import { useScroll } from "@tsu-stack/ui/hooks/use-scroll.hook";
import { cn } from "@tsu-stack/ui/lib/utils";

import { LocaleSwitcher } from "@/components/common/locale-switcher";
import { LogoWordmark } from "@/components/common/logo";
import { ThemeSwitcher } from "@/components/common/theme-switcher";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { navLinks } from "@/components/navigation/nav-links";
import { UserDropdown } from "@/components/navigation/user-dropdown";

export function Navbar() {
  const scrolled = useScroll(10);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-transparent bg-background transition-colors not-dark:shadow not-dark:shadow-transparent",
        {
          "not-dark:shadow-black/10 dark:border-border": scrolled
        }
      )}
    >
      <nav
        aria-label={m.navbar__navigation()}
        className="container mx-auto flex h-(--navbar-height) w-full items-center justify-between px-4"
      >
        <Link className="relative -m-2 rounded-lg p-2 hover:bg-muted dark:hover:bg-muted/50" to="/">
          <LogoWordmark className="h-6 w-fit" />
        </Link>
        <div className="hidden items-center gap-2 md:flex">
          {navLinks.map((link) => {
            const label = link.label();
            const className = buttonVariants({
              className: "hover:text-foreground",
              size: "sm",
              variant: "ghost"
            });

            return link.href ? (
              <a
                className={className}
                href={link.href}
                key={link.href}
                rel="noreferrer"
                target="_blank"
              >
                {label}
              </a>
            ) : (
              <Link className={className} key={link.to} to={link.to}>
                {label}
              </Link>
            );
          })}
          <LocaleSwitcher />
          <ThemeSwitcher size="icon-sm" />
          <Suspense fallback={null}>
            <UserDropdown />
          </Suspense>
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
