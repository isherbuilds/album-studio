import { Building2, BriefcaseBusiness, Crown, UserRound } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@tsu-stack/ui/components/card";
import { Skeleton } from "@tsu-stack/ui/components/skeleton";

import { useGetPlatformDashboardQuery } from "@/hooks/use-platform-admin";

export function PlatformAdminPage() {
  const dashboard = useGetPlatformDashboardQuery();
  const stats = [
    {
      icon: Building2,
      label: m.platform_admin__organizations(),
      value: dashboard.data?.organizations
    },
    {
      icon: Crown,
      label: m.platform_admin__owners(),
      value: dashboard.data?.roles.owners
    },
    {
      icon: BriefcaseBusiness,
      label: m.platform_admin__managers(),
      value: dashboard.data?.roles.managers
    },
    {
      icon: UserRound,
      label: m.platform_admin__customers(),
      value: dashboard.data?.roles.customers
    }
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          {m.platform_admin__eyebrow()}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {m.platform_admin__dashboard_title()}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {m.platform_admin__dashboard_description()}
        </p>
      </header>

      {dashboard.isError ? (
        <p className="text-sm text-destructive">{m.platform_admin__load_failed()}</p>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <Link
              className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              key={label}
              to="/admin/organizations"
            >
              <Card className="h-full transition-colors hover:bg-muted/40" size="sm">
                <CardHeader>
                  <CardDescription className="flex items-center gap-2">
                    <Icon />
                    {label}
                  </CardDescription>
                  <CardTitle className="text-3xl tabular-nums">
                    {dashboard.isPending ? <Skeleton className="h-9 w-16" /> : value}
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
