import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/components/marketing/home-page";
import { appConfig } from "@/config/app.config";
import { generateAppSeo } from "@/lib/seo";

export const Route = createFileRoute("/{-$locale}/(root-layout)/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: {
        canonicalPath: "/",
        locale: params.locale
      },
      description: appConfig.site.description
    }),
  component: HomePage
});
