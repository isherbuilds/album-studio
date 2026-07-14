import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import {
  type ProductArchiveInput,
  type ProductCreateInput,
  type ProductEditConfigurationInput,
  type ProductEditContentInput,
  type ProductEditPricingInput,
  type ProductEditor,
  type ProductPreviewInput,
  type ProductPublishInput,
  type ProductRemoveInput
} from "@tsu-stack/contract/product";
import { m } from "@tsu-stack/i18n/messages";

export function getProductsQueryOptions(organizationSlug: string) {
  return orpc.products.list.queryOptions({ input: { organizationSlug } });
}

export function getProductQueryOptions(organizationSlug: string, productSlug: string) {
  return orpc.products.bySlug.queryOptions({ input: { organizationSlug, productSlug } });
}

function showProductError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
  if (code === "FORBIDDEN") {
    toast.error(m.products__forbidden());
    return;
  }
  if (code === "PRODUCT_CONFLICT") {
    toast.error(m.products__conflict());
    return;
  }
  if (code === "PRODUCT_INVALID") {
    toast.error(m.products__invalid());
    return;
  }
  if (code === "PRODUCT_SLUG_TAKEN") {
    toast.error(m.products__slug_taken());
    return;
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
  await Promise.all([
    queryClient.invalidateQueries(getProductsQueryOptions(organizationSlug)),
    queryClient.invalidateQueries(getProductQueryOptions(organizationSlug, editor.slug))
  ]);
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
    onSuccess: (result, input) => {
      toast.success(result.result === "deleted" ? m.products__removed() : m.products__archived());
      queryClient.removeQueries(getProductsQueryOptions(organizationSlug));
      queryClient.removeQueries(getProductQueryOptions(organizationSlug, input.productSlug));
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
