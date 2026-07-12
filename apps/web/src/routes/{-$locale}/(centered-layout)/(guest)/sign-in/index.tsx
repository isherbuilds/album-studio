import { createFileRoute } from "@tanstack/react-router";

import { SignInForm } from "@/components/auth/sign-in-form";
import { appConfig } from "@/config/app.config";
import { generateAppSeo } from "@/lib/seo";

export const Route = createFileRoute("/{-$locale}/(centered-layout)/(guest)/sign-in/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: {
        canonicalPath: "/sign-in",
        locale: params.locale
      },
      description: `Sign in to access your ${appConfig.site.shortName} account and manage your saved application data.`,
      robots: {
        follow: false,
        index: false
      },
      title: "Sign In"
    }),
  component: RouteComponent
});

function RouteComponent() {
  const { redirect } = Route.useSearch();

  return <SignInForm redirectTo={redirect} />;
}
