import { Outlet, createFileRoute } from "@tanstack/react-router";

import { hasAdminRole } from "@tsu-stack/auth/access-control";
import { redirect } from "@tsu-stack/i18n/tanstack-start/lib/redirect";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/admin")({
  beforeLoad: ({ context }) => {
    if (!hasAdminRole(context.user.role)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Outlet
});
