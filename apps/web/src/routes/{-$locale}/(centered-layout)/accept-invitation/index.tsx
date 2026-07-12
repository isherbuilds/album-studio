import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { AcceptInvitationPage } from "@/components/organization/accept-invitation-page";

export const Route = createFileRoute("/{-$locale}/(centered-layout)/accept-invitation/")({
  validateSearch: zodValidator(z.object({ id: z.string().min(1) })),
  component: RouteComponent
});

function RouteComponent() {
  const { id } = Route.useSearch();
  return <AcceptInvitationPage invitationId={id} />;
}
