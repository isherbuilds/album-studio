import { useQuery } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";

export const catalogQueryKeys = {
  list: (organizationSlug: string) => orpc.catalog.list.key({ input: { organizationSlug } }),
  bySlug: (organizationSlug: string, productSlug: string) =>
    orpc.catalog.bySlug.key({ input: { organizationSlug, productSlug } })
};

export function getCatalogListQueryOptions(organizationSlug: string) {
  return orpc.catalog.list.queryOptions({ input: { organizationSlug } });
}

export function useCatalogListQuery(organizationSlug: string) {
  return useQuery(getCatalogListQueryOptions(organizationSlug));
}

export function getCatalogBySlugQueryOptions(organizationSlug: string, productSlug: string) {
  return orpc.catalog.bySlug.queryOptions({ input: { organizationSlug, productSlug } });
}

export function useCatalogBySlugQuery(organizationSlug: string, productSlug: string) {
  return useQuery(getCatalogBySlugQueryOptions(organizationSlug, productSlug));
}
