import { ArrowUpRight } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Button } from "@tsu-stack/ui/components/button";
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
          <Button asChild variant="outline">
            <Link to="/admin/organizations">
              {m.platform_admin__organizations()}
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
        }
        description={m.platform_admin__dashboard_description()}
        eyebrow={m.platform_admin__eyebrow()}
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
              label: m.platform_admin__organizations(),
              value: dashboard.isPending ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                dashboard.data.organizations
              )
            },
            {
              label: m.platform_admin__owners(),
              value: dashboard.isPending ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                dashboard.data.roles.owners
              )
            },
            {
              label: m.platform_admin__managers(),
              value: dashboard.isPending ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                dashboard.data.roles.managers
              )
            },
            {
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
