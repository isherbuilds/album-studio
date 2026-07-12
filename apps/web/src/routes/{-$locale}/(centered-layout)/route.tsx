import { Outlet, createFileRoute } from "@tanstack/react-router";

import { CenteredLayout } from "@/components/layout/centered-layout";

export const Route = createFileRoute("/{-$locale}/(centered-layout)")({
  component: () => (
    <CenteredLayout>
      <Outlet />
    </CenteredLayout>
  )
});
