import { a11yDevtoolsPlugin } from "@tanstack/devtools-a11y/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Fragment } from "react";

import { type AuthQueryResult } from "@tsu-stack/auth/react/tanstack-start/queries";
import { getAuthUserQueryOptions } from "@tsu-stack/auth/react/tanstack-start/queries";
import { resolvePublicAssetUrl } from "@tsu-stack/core/assets";
import { ENV_WEB_ISOMORPHIC } from "@tsu-stack/env/web/env.isomorphic";
import {
  LocaleProvider,
  useLocale
} from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Toaster } from "@tsu-stack/ui/components/sonner";

import { ThemeProvider } from "@/components/common/theme-switcher";
import { ProgressProvider } from "@/components/providers/progress-provider";
import { DefaultErrorPage } from "@/components/system/default-error-page";
import { generateAppSeo } from "@/lib/seo";

import appCss from "@/styles/app.css?url";

// Root route with shared context for the entire app, inject them in router.tsx
type RouterAppContext = {
  queryClient: QueryClient;
  user: AuthQueryResult;
};

export const Route = createRootRouteWithContext<RouterAppContext>()({
  errorComponent: DefaultErrorPage,
  shellComponent: RootDocument,
  beforeLoad: ({ context, preload }) => {
    // Don't prefetch during preload to prevent spamming the server with getSession requests
    if (!preload) {
      // Prefetch (don't await) the user data on app load to have it ready for any route that needs it, and to set the auth state early
      void context.queryClient.prefetchQuery(getAuthUserQueryOptions());
    }
  },
  head: () => {
    const rootSeo = generateAppSeo({
      includeDocumentMeta: true
    });
    const faviconHref = resolvePublicAssetUrl(ENV_WEB_ISOMORPHIC.VITE_WEB_URL, "/favicon.ico");
    const sitemapHref = resolvePublicAssetUrl(ENV_WEB_ISOMORPHIC.VITE_WEB_URL, "/sitemap.xml");

    return {
      links: [
        ...(rootSeo.links ?? []),
        {
          href: faviconHref,
          rel: "icon"
        },
        {
          href: sitemapHref,
          rel: "sitemap",
          type: "application/xml"
        },
        { href: appCss, rel: "stylesheet" }
      ],
      meta: [...(rootSeo.meta ?? [])]
    };
  }
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <RootDocumentInner>{children}</RootDocumentInner>
    </LocaleProvider>
  );
}

function RootDocumentInner({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <ProgressProvider>
            <Fragment key={locale}>{children}</Fragment>
            <Toaster richColors />
            <TanStackDevtools
              plugins={[
                {
                  name: "TanStack Query",
                  render: <ReactQueryDevtoolsPanel />
                },
                {
                  name: "TanStack Router",
                  render: <TanStackRouterDevtoolsPanel />
                },
                a11yDevtoolsPlugin()
              ]}
            />
            <Scripts />
          </ProgressProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
