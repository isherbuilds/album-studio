import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isDefinedError, orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { type PaymentRecordInput, type PaymentReverseInput } from "@tsu-stack/contract/payment";
import { m } from "@tsu-stack/i18n/messages";

export function getPaymentLedgerQueryOptions(organizationSlug: string, orderNumber: string) {
  return orpc.payments.listByOrder.queryOptions({ input: { orderNumber, organizationSlug } });
}

export function usePaymentLedgerQuery(organizationSlug: string, orderNumber: string) {
  return useQuery(getPaymentLedgerQueryOptions(organizationSlug, orderNumber));
}

export function usePaymentActions(organizationSlug: string, orderNumber: string) {
  const queryClient = useQueryClient();
  const refreshLedger = async () => {
    await queryClient.invalidateQueries(
      getPaymentLedgerQueryOptions(organizationSlug, orderNumber)
    );
  };
  const record = useMutation({
    ...orpc.payments.record.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === "PAYMENT_OVERAGE"
            ? m.payments__overage()
            : m.payments__update_failed()
        );
      },
      onSuccess: refreshLedger
    }),
    mutationFn: (input: Omit<PaymentRecordInput, "orderNumber" | "organizationSlug">) =>
      orpc.payments.record.call({ ...input, orderNumber, organizationSlug })
  });
  const reverse = useMutation({
    ...orpc.payments.reverse.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === "PAYMENT_OVERAGE"
            ? m.payments__overage()
            : m.payments__update_failed()
        );
      },
      onSuccess: refreshLedger
    }),
    mutationFn: (input: Omit<PaymentReverseInput, "orderNumber" | "organizationSlug">) =>
      orpc.payments.reverse.call({ ...input, orderNumber, organizationSlug })
  });

  return { record, reverse };
}
