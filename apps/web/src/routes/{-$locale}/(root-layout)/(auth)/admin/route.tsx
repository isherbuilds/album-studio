import { Outlet, createFileRoute } from "@tanstack/react-router";

import { redirect } from "@tsu-stack/i18n/tanstack-start/lib/redirect";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/admin")({
  beforeLoad: ({ context }) => {
    const roles = context.user.role?.split(",").map((role) => role.trim()) ?? [];
    if (!roles.includes("admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Outlet
});
