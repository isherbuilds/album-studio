import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";

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
        className="grid size-6 place-items-center rounded-md bg-foreground text-[0.625rem] font-semibold text-background"
      >
        AS
      </span>
      <span className="truncate text-sm font-semibold tracking-tight">{organizationName}</span>
    </span>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl flex-wrap items-center gap-2 px-5 py-2 sm:flex-nowrap sm:gap-4 sm:px-8 sm:py-0">
          <Link
            aria-label={organizationName}
            className="-m-2 min-w-0 rounded-md p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mr-2"
            params={{ organizationSlug }}
            to="/org/$organizationSlug/catalog"
          >
            {brand}
          </Link>
          <nav className="order-3 flex w-full items-center gap-1 sm:order-0 sm:w-auto">
            <Link
              activeProps={{ className: "bg-muted text-foreground" }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              params={{ organizationSlug }}
              to="/org/$organizationSlug/catalog"
            >
              {m.storefront__catalog()}
            </Link>
            <Link
              activeProps={{ className: "bg-muted text-foreground" }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              params={{ organizationSlug }}
              to="/org/$organizationSlug/drafts"
            >
              {m.storefront__drafts()}
            </Link>
            <Link
              activeProps={{
                className:
                  "rounded-md bg-muted px-3 py-1.5 text-sm text-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              params={{ organizationSlug }}
              to="/org/$organizationSlug/orders"
            >
              {m.storefront__orders()}
            </Link>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeSwitcher size="icon-sm" variant="ghost" />
            <UserDropdown />
          </div>
        </div>
      </header>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
