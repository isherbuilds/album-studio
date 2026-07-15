import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { AcceptInvitationPage } from "@/components/organization/accept-invitation-page";
import { generateAppSeo } from "@/lib/seo";

export const Route = createFileRoute("/{-$locale}/(centered-layout)/(guest)/accept-invitation/")({
  validateSearch: zodValidator(z.object({ id: z.string().min(1) })),
  head: () =>
    generateAppSeo({
      robots: {
        follow: false,
        index: false
      },
      title: "Accept Invitation"
    }),
  component: RouteComponent
});

function RouteComponent() {
  const { id } = Route.useSearch();
  return <AcceptInvitationPage invitationId={id} />;
}
