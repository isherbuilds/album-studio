import { createFileRoute } from "@tanstack/react-router";

import { redirect } from "@tsu-stack/i18n/tanstack-start/lib/redirect";

export const Route = createFileRoute("/{-$locale}/(root-layout)/(auth)/$organizationSlug/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      params: { organizationSlug: params.organizationSlug },
      to: "/$organizationSlug/dashboard"
    });
  }
});
