import { Outlet, createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { hasAdminRole } from "@tsu-stack/auth/access-control";
import { getAuthUserQueryOptions } from "@tsu-stack/auth/react/tanstack-start/queries";
import { redirect } from "@tsu-stack/i18n/tanstack-start/lib/redirect";
import { validateNavigateTo } from "@tsu-stack/i18n/tanstack-start/lib/validate-navigate-to";

import { listMyOrganizationsQueryOptions } from "@/hooks/use-organization";
import { routeTree } from "@/routeTree.gen";

const guestSearchSchema = z.object({
  redirect: z
    .string()
    .optional()
    .catch(undefined)
    .transform((val) => {
      if (val === undefined) return undefined;
      return validateNavigateTo({
        fallbackTo: "/",
        routeTree,
        shouldIncludeRoute: (route) => !route.id.includes("(guest)"),
        to: val
      });
    })
});

export const Route = createFileRoute("/{-$locale}/(centered-layout)/(guest)")({
  validateSearch: zodValidator(guestSearchSchema),
  component: Outlet,
  beforeLoad: async ({ context, search }) => {
    const user = await context.queryClient.ensureQueryData({
      ...getAuthUserQueryOptions(),
      revalidateIfStale: true
    });

    const redirectTo = search.redirect;

    if (user) {
      if (redirectTo) {
        throw redirect({ to: redirectTo });
      }
      if (hasAdminRole(user.role)) {
        throw redirect({ to: "/admin" });
      }

      const memberships = await context.queryClient.fetchQuery({
        ...listMyOrganizationsQueryOptions(),
        staleTime: 0
      });
      const [membership] = memberships;
      if (memberships.length !== 1 || !membership) {
        throw redirect({ to: "/select-organization" });
      }

      throw redirect({
        params: { organizationSlug: membership.slug },
        to: "/$organizationSlug/dashboard"
      });
    }

    return {
      // The sign-in page uses this to redirect after successful authentication.
      redirectTo
    };
  }
});
