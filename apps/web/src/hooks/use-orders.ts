import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isDefinedError, orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type ConfigurationIssue } from "@tsu-stack/contract/configuration";
import { type ConfigurationDraftEditor } from "@tsu-stack/contract/draft";
import {
  type OrderDetail,
  type OrderPlaceInput,
  type OrderPriceChange
} from "@tsu-stack/contract/order";

import { getDraftByIdQueryOptions, getDraftListQueryOptions } from "@/hooks/use-drafts";

export function getOrderListQueryOptions(organizationSlug: string) {
  return orpc.orders.list.queryOptions({ input: { organizationSlug } });
}

export function getOrderByNumberQueryOptions(organizationSlug: string, orderNumber: string) {
  return orpc.orders.byNumber.queryOptions({ input: { orderNumber, organizationSlug } });
}

export function useOrderListQuery(organizationSlug: string) {
  return useQuery(getOrderListQueryOptions(organizationSlug));
}

export function useOrderByNumberQuery(organizationSlug: string, orderNumber: string) {
  return useQuery(getOrderByNumberQueryOptions(organizationSlug, orderNumber));
}

export function usePlaceOrderMutation(
  organizationSlug: string,
  draftId: string,
  handlers: {
    onConfigurationInvalid: (data: {
      issues: ConfigurationIssue[];
      product: ConfigurationDraftEditor["product"];
    }) => void;
    onFailure: () => void;
    onPlaced: (order: OrderDetail) => void;
    onPriceChanged: (change: OrderPriceChange) => void;
  }
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.orders.place.mutationOptions({
      onError: (error) => {
        if (
          isDefinedError(error) &&
          (error.code === "PRICE_CHANGED" || error.code === "CONFIGURATION_INVALID")
        ) {
          queryClient.setQueryData<ConfigurationDraftEditor>(
            getDraftByIdQueryOptions(organizationSlug, draftId).queryKey,
            (editor) => (editor ? { ...editor, product: error.data.product } : editor)
          );
          if (error.code === "PRICE_CHANGED") handlers.onPriceChanged(error.data);
          else handlers.onConfigurationInvalid(error.data);
          return;
        }
        handlers.onFailure();
      }
    }),
    mutationFn: (input: Omit<OrderPlaceInput, "organizationSlug">) =>
      orpc.orders.place.call({ ...input, organizationSlug }),
    onSuccess: async (order) => {
      queryClient.removeQueries(getDraftByIdQueryOptions(organizationSlug, draftId));
      queryClient.setQueryData(
        getOrderByNumberQueryOptions(organizationSlug, order.number).queryKey,
        order
      );
      await Promise.all([
        queryClient.invalidateQueries(getDraftListQueryOptions(organizationSlug)),
        queryClient.invalidateQueries(getOrderListQueryOptions(organizationSlug))
      ]);
      handlers.onPlaced(order);
    }
  });
}
