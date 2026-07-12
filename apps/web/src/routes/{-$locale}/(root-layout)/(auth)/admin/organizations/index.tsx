import { createFileRoute } from "@tanstack/react-router";

import { PlatformOrganizationsPage } from "@/components/platform-admin/platform-organizations-page";
import { listOrganizationsQueryOptions } from "@/hooks/use-platform-admin";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/admin/organizations/")({
  beforeLoad: ({ context }) => context.queryClient.ensureQueryData(listOrganizationsQueryOptions()),
  component: PlatformOrganizationsPage
});
