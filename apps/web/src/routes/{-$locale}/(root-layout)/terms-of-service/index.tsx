import { createFileRoute } from "@tanstack/react-router";

import { TermsOfServicePage } from "@/components/legal/terms-of-service-page";
import { appConfig } from "@/config/app.config";
import { generateAppSeo } from "@/lib/seo";

export const Route = createFileRoute("/{-$locale}/(root-layout)/terms-of-service/")({
  head: ({ params }) =>
    generateAppSeo({
      alternates: {
        canonicalPath: "/terms-of-service",
        locale: params.locale
      },
      description: `Review the rules, responsibilities, and terms for using ${appConfig.site.shortName}.`,
      title: "Terms of Service"
    }),
  component: TermsOfServicePage
});
