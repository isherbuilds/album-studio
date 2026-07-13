import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/dashboard")({
  component: DashboardLayout
});

function DashboardLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
