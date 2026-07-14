import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isDefinedError, orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type ConfigurationIssue } from "@tsu-stack/contract/configuration";
import { type ConfigurationDraftEditor } from "@tsu-stack/contract/draft";
import {
  type OrderCorrectProjectNameInput,
  type OrderDecideCancellationInput,
  type OrderDetail,
  type OrderPlaceInput,
  type OrderPriceChange,
  type OrderTransitionInput
} from "@tsu-stack/contract/order";
import { m } from "@tsu-stack/i18n/messages";

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

export function useOrderActions(organizationSlug: string, orderNumber: string) {
  const queryClient = useQueryClient();
  const updateOrder = async (order: OrderDetail) => {
    queryClient.setQueryData(
      getOrderByNumberQueryOptions(organizationSlug, orderNumber).queryKey,
      order
    );
    await queryClient.invalidateQueries(getOrderListQueryOptions(organizationSlug));
  };

  const transition = useMutation({
    ...orpc.orders.transition.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === "INVALID_ORDER_TRANSITION"
            ? m.orders__invalid_transition()
            : m.orders__update_failed()
        );
      },
      onSuccess: updateOrder
    }),
    mutationFn: (input: Pick<OrderTransitionInput, "status">) =>
      orpc.orders.transition.call({ ...input, orderNumber, organizationSlug })
  });
  const correctProjectName = useMutation({
    ...orpc.orders.correctProjectName.mutationOptions({
      onError: () => toast.error(m.orders__update_failed()),
      onSuccess: updateOrder
    }),
    mutationFn: (input: Pick<OrderCorrectProjectNameInput, "projectName">) =>
      orpc.orders.correctProjectName.call({ ...input, orderNumber, organizationSlug })
  });
  const requestCancellation = useMutation({
    ...orpc.orders.requestCancellation.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === "INVALID_ORDER_TRANSITION"
            ? m.orders__invalid_transition()
            : m.orders__update_failed()
        );
      },
      onSuccess: updateOrder
    }),
    mutationFn: () => orpc.orders.requestCancellation.call({ orderNumber, organizationSlug })
  });
  const decideCancellation = useMutation({
    ...orpc.orders.decideCancellation.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === "INVALID_ORDER_TRANSITION"
            ? m.orders__invalid_transition()
            : m.orders__update_failed()
        );
      },
      onSuccess: updateOrder
    }),
    mutationFn: (input: Pick<OrderDecideCancellationInput, "decision">) =>
      orpc.orders.decideCancellation.call({ ...input, orderNumber, organizationSlug })
  });
  const duplicateToDraft = useMutation({
    ...orpc.orders.duplicateToDraft.mutationOptions({
      onError: () => toast.error(m.orders__duplicate_failed()),
      onSuccess: async () => {
        await queryClient.invalidateQueries(getDraftListQueryOptions(organizationSlug));
      }
    }),
    mutationFn: () => orpc.orders.duplicateToDraft.call({ orderNumber, organizationSlug })
  });

  return {
    correctProjectName,
    decideCancellation,
    duplicateToDraft,
    requestCancellation,
    transition
  };
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
    mutationFn: (input: Omit<OrderPlaceInput, "draftId" | "organizationSlug">) =>
      orpc.orders.place.call({ ...input, draftId, organizationSlug }),
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
