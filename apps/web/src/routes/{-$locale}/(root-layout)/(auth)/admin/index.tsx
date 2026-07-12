import { createFileRoute } from "@tanstack/react-router";

import { PlatformAdminPage } from "@/components/platform-admin/platform-admin-page";
import { getPlatformDashboardQueryOptions } from "@/hooks/use-platform-admin";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/admin/")({
  beforeLoad: ({ context }) =>
    context.queryClient.ensureQueryData(getPlatformDashboardQueryOptions()),
  component: PlatformAdminPage
});
