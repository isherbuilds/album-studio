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
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            aria-label={organizationName}
            className="-m-2 min-w-0 rounded-md p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            params={{ organizationSlug }}
            to="/org/$organizationSlug/catalog"
          >
            {brand}
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeSwitcher size="icon-sm" variant="ghost" />
            <UserDropdown />
          </div>
        </div>
      </header>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
