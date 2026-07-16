import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isDefinedError, orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import {
  type ProductArchiveInput,
  type ProductCreateInput,
  type ProductEditConfigurationInput,
  type ProductEditContentInput,
  type ProductEditPricingInput,
  type ProductEditor,
  type ProductPreviewInput,
  type ProductPublishInput,
  type ProductStatus,
  type ProductRemoveInput
} from "@tsu-stack/contract/product";
import { m } from "@tsu-stack/i18n/messages";

export type ProductListParams = {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: ProductStatus;
};

export function getProductsQueryOptions(
  organizationSlug: string,
  { page = 1, pageSize = 20, query = "", status }: ProductListParams = {}
) {
  return orpc.products.list.queryOptions({
    input: {
      organizationSlug,
      page,
      pageSize,
      query,
      ...(status ? { status } : {})
    }
  });
}

export function getProductQueryOptions(organizationSlug: string, productSlug: string) {
  return orpc.products.bySlug.queryOptions({ input: { organizationSlug, productSlug } });
}

type ProductMutationError = Parameters<
  NonNullable<ReturnType<typeof orpc.products.create.mutationOptions>["onError"]>
>[0];

function showProductError(error: ProductMutationError) {
  if (isDefinedError(error)) {
    switch (error.code) {
      case "FORBIDDEN":
        toast.error(m.products__forbidden());
        return;
      case "PRODUCT_CONFLICT":
        toast.error(m.products__conflict());
        return;
      case "PRODUCT_INVALID":
        toast.error(m.products__invalid());
        return;
      case "PRODUCT_SLUG_TAKEN":
        toast.error(m.products__slug_taken());
        return;
      case "NOT_FOUND":
      case "UNAUTHORIZED":
        break;
    }
  }
  toast.error(m.products__update_failed());
}

async function refreshEditor(
  queryClient: QueryClient,
  organizationSlug: string,
  previousSlug: string,
  editor: ProductEditor
) {
  if (previousSlug !== editor.slug) {
    queryClient.removeQueries(getProductQueryOptions(organizationSlug, previousSlug));
  }
  queryClient.setQueryData(getProductQueryOptions(organizationSlug, editor.slug).queryKey, editor);
  await queryClient.invalidateQueries({
    queryKey: orpc.products.list.key({ input: { organizationSlug } })
  });
}

export function useProductActions(organizationSlug: string) {
  const queryClient = useQueryClient();

  const create = useMutation({
    ...orpc.products.create.mutationOptions({ onError: showProductError }),
    mutationFn: (input: Omit<ProductCreateInput, "organizationSlug">) =>
      orpc.products.create.call({ ...input, organizationSlug }),
    onSuccess: async (editor) => {
      toast.success(m.products__created());
      await refreshEditor(queryClient, organizationSlug, editor.slug, editor);
    }
  });

  const editContent = useMutation({
    ...orpc.products.editContent.mutationOptions({ onError: showProductError }),
    mutationFn: (input: Omit<ProductEditContentInput, "organizationSlug">) =>
      orpc.products.editContent.call({ ...input, organizationSlug }),
    onSuccess: async (editor, input) => {
      toast.success(m.products__saved());
      await refreshEditor(queryClient, organizationSlug, input.productSlug, editor);
    }
  });

  const editConfiguration = useMutation({
    ...orpc.products.editConfiguration.mutationOptions({ onError: showProductError }),
    mutationFn: (input: Omit<ProductEditConfigurationInput, "organizationSlug">) =>
      orpc.products.editConfiguration.call({ ...input, organizationSlug }),
    onSuccess: async (editor, input) => {
      toast.success(m.products__saved());
      await refreshEditor(queryClient, organizationSlug, input.productSlug, editor);
    }
  });

  const editPricing = useMutation({
    ...orpc.products.editPricing.mutationOptions({ onError: showProductError }),
    mutationFn: (input: Omit<ProductEditPricingInput, "organizationSlug">) =>
      orpc.products.editPricing.call({ ...input, organizationSlug }),
    onSuccess: async (editor, input) => {
      toast.success(m.products__saved());
      await refreshEditor(queryClient, organizationSlug, input.productSlug, editor);
    }
  });

  const preview = useMutation({
    ...orpc.products.preview.mutationOptions({ onError: showProductError }),
    mutationFn: (input: Omit<ProductPreviewInput, "organizationSlug">) =>
      orpc.products.preview.call({ ...input, organizationSlug })
  });

  const publish = useMutation({
    ...orpc.products.publish.mutationOptions({ onError: showProductError }),
    mutationFn: (input: Omit<ProductPublishInput, "organizationSlug">) =>
      orpc.products.publish.call({ ...input, organizationSlug }),
    onSuccess: async (editor, input) => {
      toast.success(m.products__published());
      await refreshEditor(queryClient, organizationSlug, input.productSlug, editor);
    }
  });

  const archive = useMutation({
    ...orpc.products.archive.mutationOptions({ onError: showProductError }),
    mutationFn: (input: Omit<ProductArchiveInput, "organizationSlug">) =>
      orpc.products.archive.call({ ...input, organizationSlug }),
    onSuccess: async (editor, input) => {
      toast.success(m.products__archived());
      await refreshEditor(queryClient, organizationSlug, input.productSlug, editor);
    }
  });

  const remove = useMutation({
    ...orpc.products.remove.mutationOptions({ onError: showProductError }),
    mutationFn: (input: Omit<ProductRemoveInput, "organizationSlug">) =>
      orpc.products.remove.call({ ...input, organizationSlug }),
    onSuccess: async (result, input) => {
      toast.success(result.result === "deleted" ? m.products__removed() : m.products__archived());
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.products.list.key({ input: { organizationSlug } }),
          refetchType: "all"
        }),
        queryClient.invalidateQueries({
          exact: true,
          queryKey: getProductQueryOptions(organizationSlug, input.productSlug).queryKey,
          refetchType: "none"
        })
      ]);
    }
  });

  return {
    archive,
    create,
    editConfiguration,
    editContent,
    editPricing,
    preview,
    publish,
    remove
  };
}
