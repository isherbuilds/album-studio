import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isDefinedError, type client, orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import {
  type InventoryCreateComponentInput,
  type InventoryEditComponentInput,
  type InventoryRecordMovementInput,
  type InventorySetAvailabilityInput
} from "@tsu-stack/contract/inventory";
import { m } from "@tsu-stack/i18n/messages";

export type InventoryComponent = Awaited<ReturnType<typeof client.inventory.createComponent>>;

const showInventoryError = () => toast.error(m.inventory__update_failed());

export function getInventoryListQueryOptions(organizationSlug: string) {
  return orpc.inventory.list.queryOptions({ input: { organizationSlug } });
}

export function getInventoryMovementsQueryOptions(organizationSlug: string, componentId: string) {
  return orpc.inventory.listMovements.queryOptions({
    input: { componentId, organizationSlug }
  });
}

export function useInventoryActions(organizationSlug: string) {
  const queryClient = useQueryClient();
  const refresh = async (componentId?: string) => {
    const refreshes = [
      queryClient.invalidateQueries(getInventoryListQueryOptions(organizationSlug))
    ];
    if (componentId) {
      refreshes.push(
        queryClient.invalidateQueries(
          getInventoryMovementsQueryOptions(organizationSlug, componentId)
        )
      );
    }
    await Promise.all(refreshes);
  };
  const createComponent = useMutation({
    ...orpc.inventory.createComponent.mutationOptions({ onError: showInventoryError }),
    mutationFn: (input: Omit<InventoryCreateComponentInput, "organizationSlug">) =>
      orpc.inventory.createComponent.call({ ...input, organizationSlug }),
    onSuccess: () => refresh()
  });
  const editComponent = useMutation({
    ...orpc.inventory.editComponent.mutationOptions({ onError: showInventoryError }),
    mutationFn: (input: Omit<InventoryEditComponentInput, "organizationSlug">) =>
      orpc.inventory.editComponent.call({ ...input, organizationSlug }),
    onSuccess: (component) => refresh(component.id)
  });
  const recordMovement = useMutation({
    ...orpc.inventory.recordMovement.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === "QUANTITY_OUT_OF_RANGE"
            ? m.inventory__quantity_out_of_range()
            : m.inventory__update_failed()
        );
      }
    }),
    mutationFn: (input: Omit<InventoryRecordMovementInput, "organizationSlug">) =>
      orpc.inventory.recordMovement.call({ ...input, organizationSlug }),
    onSuccess: ({ component }) => refresh(component.id)
  });
  const setAvailability = useMutation({
    ...orpc.inventory.setAvailability.mutationOptions({ onError: showInventoryError }),
    mutationFn: (input: Omit<InventorySetAvailabilityInput, "organizationSlug">) =>
      orpc.inventory.setAvailability.call({ ...input, organizationSlug }),
    onSuccess: (component) => refresh(component.id)
  });

  return { createComponent, editComponent, recordMovement, setAvailability };
}
