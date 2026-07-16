import { m } from "@tsu-stack/i18n/messages";
import { Skeleton } from "@tsu-stack/ui/components/skeleton";

import { WorkspacePage, WorkspacePageHeader } from "@/components/admin/workspace";
import { useGetOrganizationQuery } from "@/hooks/use-platform-admin";

export function PlatformOrganizationPage({ slug }: { slug: string }) {
  const organization = useGetOrganizationQuery(slug);

  return (
    <WorkspacePage>
      {organization.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {m.platform_admin__organization_load_failed()}
        </p>
      ) : organization.data ? (
        <WorkspacePageHeader description={`/${slug}`} title={organization.data.name} />
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      )}
    </WorkspacePage>
  );
}
