import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";

import { LocaleSwitcher } from "@/components/common/locale-switcher";
import { ThemeSwitcher } from "@/components/common/theme-switcher";
import { UserDropdown } from "@/components/navigation/user-dropdown";

export function StorefrontShell({
  children,
  organizationName,
  organizationSlug
}: {
  children: React.ReactNode;
  organizationName: string;
  organizationSlug: string;
}) {
  const brand = (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-lg bg-foreground text-[0.625rem] font-semibold text-background"
      >
        AS
      </span>
      <span className="truncate text-sm font-semibold tracking-tight">{organizationName}</span>
    </span>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-0">
          <Link
            aria-label={organizationName}
            className="-m-2 min-w-0 rounded-lg p-2 outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:mr-2"
            params={{ organizationSlug }}
            to="/$organizationSlug/catalog"
          >
            {brand}
          </Link>
          <nav
            aria-label={m.navbar__navigation()}
            className="order-3 flex w-full items-center gap-1 sm:order-0 sm:w-auto"
          >
            <Link
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground outline-hidden hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              params={{ organizationSlug }}
              to="/$organizationSlug/catalog"
            >
              {m.storefront__catalog()}
            </Link>
            <Link
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground outline-hidden hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              params={{ organizationSlug }}
              to="/$organizationSlug/drafts"
            >
              {m.storefront__drafts()}
            </Link>
            <Link
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground outline-hidden hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              params={{ organizationSlug }}
              to="/$organizationSlug/orders"
            >
              {m.storefront__orders()}
            </Link>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <LocaleSwitcher size="icon-sm" variant="ghost" />
            <ThemeSwitcher size="icon-sm" variant="ghost" />
            <UserDropdown />
          </div>
        </div>
      </header>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
