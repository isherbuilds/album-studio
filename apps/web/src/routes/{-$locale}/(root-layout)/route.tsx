import { Outlet, createFileRoute } from "@tanstack/react-router";

import { RootLayout } from "@/components/layout/root-layout";

export const Route = createFileRoute("/{-$locale}/(root-layout)")({
  component: () => (
    <RootLayout>
      <Outlet />
    </RootLayout>
  )
});
