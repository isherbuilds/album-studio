import { ArrowUpRight } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { buttonVariants } from "@tsu-stack/ui/components/button";
import { Skeleton } from "@tsu-stack/ui/components/skeleton";

import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceStatStrip
} from "@/components/admin/workspace";
import { useGetPlatformDashboardQuery } from "@/hooks/use-platform-admin";

export function PlatformAdminPage() {
  const dashboard = useGetPlatformDashboardQuery();

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        actions={
          <Link className={buttonVariants({ variant: "outline" })} to="/admin/organizations">
            {m.platform_admin__organizations()}
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        }
        description={m.platform_admin__dashboard_description()}
        title={m.platform_admin__dashboard_title()}
      />

      {dashboard.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {m.platform_admin__load_failed()}
        </p>
      ) : (
        <WorkspaceStatStrip
          label={m.platform_admin__dashboard_title()}
          stats={[
            {
              id: "organizations",
              label: m.platform_admin__organizations(),
              value: dashboard.isPending ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                dashboard.data.organizations
              )
            },
            {
              id: "owners",
              label: m.platform_admin__owners(),
              value: dashboard.isPending ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                dashboard.data.roles.owners
              )
            },
            {
              id: "managers",
              label: m.platform_admin__managers(),
              value: dashboard.isPending ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                dashboard.data.roles.managers
              )
            },
            {
              id: "customers",
              label: m.platform_admin__customers(),
              value: dashboard.isPending ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                dashboard.data.roles.customers
              )
            }
          ]}
        />
      )}
    </WorkspacePage>
  );
}
