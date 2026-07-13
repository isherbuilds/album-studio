import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isDefinedError } from "@tsu-stack/api/client/tanstack-start/orpc";
import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { m } from "@tsu-stack/i18n/messages";

export const platformAdminQueryKeys = {
  dashboard: () => orpc.platform.dashboard.key(),
  organizations: () => orpc.platform.organizations.list.key()
};

export function getPlatformDashboardQueryOptions() {
  return orpc.platform.dashboard.queryOptions();
}

export function useGetPlatformDashboardQuery() {
  return useQuery(getPlatformDashboardQueryOptions());
}

export function listOrganizationsQueryOptions() {
  return orpc.platform.organizations.list.queryOptions();
}

export function useListOrganizationsQuery() {
  return useQuery(listOrganizationsQueryOptions());
}

export function getOrganizationQueryOptions(slug: string) {
  return orpc.platform.organizations.bySlug.queryOptions({ input: { slug } });
}

export function useGetOrganizationQuery(slug: string) {
  return useQuery(getOrganizationQueryOptions(slug));
}

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.platform.organizations.create.mutationOptions({
      onError: (error) => {
        if (isDefinedError(error)) {
          switch (error.code) {
            case "ORGANIZATION_SLUG_TAKEN":
              toast.error(m.platform_admin__slug_taken());
              return;
            case "FORBIDDEN":
            case "UNAUTHORIZED":
              toast.error(error.message);
              return;
          }
        }
        toast.error(m.platform_admin__create_failed());
      },
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: platformAdminQueryKeys.dashboard() }),
          queryClient.invalidateQueries({ queryKey: platformAdminQueryKeys.organizations() })
        ]);
      }
    })
  );
}
