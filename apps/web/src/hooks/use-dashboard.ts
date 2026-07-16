import { useQuery } from "@tanstack/react-query";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";

export function getOwnerDashboardQueryOptions(organizationSlug: string) {
  return orpc.dashboards.owner.queryOptions({ input: { organizationSlug } });
}

export function getManagerDashboardQueryOptions(organizationSlug: string) {
  return orpc.dashboards.manager.queryOptions({ input: { organizationSlug } });
}

export function getCustomerDashboardQueryOptions(organizationSlug: string) {
  return orpc.dashboards.customer.queryOptions({ input: { organizationSlug } });
}

export function useOwnerDashboardQuery(organizationSlug: string) {
  return useQuery(getOwnerDashboardQueryOptions(organizationSlug));
}

export function useManagerDashboardQuery(organizationSlug: string) {
  return useQuery(getManagerDashboardQueryOptions(organizationSlug));
}

export function useCustomerDashboardQuery(organizationSlug: string) {
  return useQuery(getCustomerDashboardQueryOptions(organizationSlug));
}
