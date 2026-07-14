import { z } from "zod";

import {
  ProductArchiveInputSchema,
  ProductBySlugInputSchema,
  ProductCreateInputSchema,
  ProductDefinitionValidationIssueSchema,
  ProductEditConfigurationInputSchema,
  ProductEditContentInputSchema,
  ProductEditPricingInputSchema,
  ProductEditorSchema,
  ProductListInputSchema,
  ProductListItemSchema,
  ProductPreviewInputSchema,
  ProductPreviewResultSchema,
  ProductPublishInputSchema,
  ProductRemoveInputSchema,
  ProductRemoveResultSchema,
  ProductRevisionSchema
} from "@tsu-stack/contract/product";
import { evaluateConfiguration } from "@tsu-stack/core/configuration";
import {
  archiveProduct,
  createProduct,
  editProductContent,
  editProductPricing,
  listProducts,
  loadProductAvailability,
  loadProductEditor,
  parseProductEditorDefinition,
  publishProduct,
  removeProduct,
  replaceProductConfiguration
} from "@tsu-stack/core/product";

import { organizationActionProcedure } from "#@/lib/procedures/factory";

const productErrors = {
  PRODUCT_CONFLICT: {
    data: z.object({ revision: ProductRevisionSchema }),
    message: "Product changed in another session",
    status: 409
  },
  PRODUCT_INVALID: {
    data: z.object({ issues: z.array(ProductDefinitionValidationIssueSchema).min(1) }),
    message: "Product definition is incomplete or invalid",
    status: 422
  },
  PRODUCT_SLUG_TAKEN: {
    message: "A Product already uses this slug",
    status: 409
  }
} as const;

async function loadUpdatedEditor(
  db: Parameters<typeof loadProductEditor>[0],
  input: { organizationId: string; productId: string }
) {
  const editor = await loadProductEditor(db, input);
  if (!editor) throw new Error("Updated Product could not be loaded");
  return editor;
}

export const productsRouter = {
  archive: organizationActionProcedure(ProductArchiveInputSchema, "product.manage")
    .route({ description: "Archive a Product", method: "POST" })
    .errors(productErrors)
    .output(ProductEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await archiveProduct(context.db, {
        actorUserId: context.authSession.user.id,
        expectedRevision: input.expectedRevision,
        organizationId: context.organization.id,
        productSlug: input.productSlug
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Product not found" });
      if (result.kind === "conflict") {
        throw errors.PRODUCT_CONFLICT({ data: { revision: result.revision } });
      }
      return loadUpdatedEditor(context.db, {
        organizationId: context.organization.id,
        productId: result.id
      });
    }),
  bySlug: organizationActionProcedure(ProductBySlugInputSchema, "product.manage")
    .route({ description: "Load a Product editor definition", method: "GET" })
    .output(ProductEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const editor = await loadProductEditor(context.db, {
        organizationId: context.organization.id,
        productSlug: input.productSlug
      });
      if (!editor) throw errors.NOT_FOUND({ message: "Product not found" });
      return editor;
    }),
  create: organizationActionProcedure(ProductCreateInputSchema, "product.manage")
    .route({ description: "Create a draft Product shell", method: "POST" })
    .errors(productErrors)
    .output(ProductEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await createProduct(context.db, {
        actorUserId: context.authSession.user.id,
        description: input.description,
        imageUrls: input.imageUrls,
        name: input.name,
        organizationId: context.organization.id,
        slug: input.slug
      });
      if (result.kind === "slug_taken") throw errors.PRODUCT_SLUG_TAKEN();
      return loadUpdatedEditor(context.db, {
        organizationId: context.organization.id,
        productId: result.id
      });
    }),
  editConfiguration: organizationActionProcedure(
    ProductEditConfigurationInputSchema,
    "product.manage"
  )
    .route({ description: "Replace a Product configuration definition", method: "PUT" })
    .errors(productErrors)
    .output(ProductEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await replaceProductConfiguration(context.db, {
        actorUserId: context.authSession.user.id,
        expectedRevision: input.expectedRevision,
        groups: input.groups,
        organizationId: context.organization.id,
        productSlug: input.productSlug
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Product not found" });
      if (result.kind === "conflict") {
        throw errors.PRODUCT_CONFLICT({ data: { revision: result.revision } });
      }
      if (result.kind === "invalid") {
        throw errors.PRODUCT_INVALID({ data: { issues: [...result.issues] } });
      }
      return loadUpdatedEditor(context.db, {
        organizationId: context.organization.id,
        productId: result.id
      });
    }),
  editContent: organizationActionProcedure(ProductEditContentInputSchema, "product.manage")
    .route({ description: "Edit Product content", method: "PATCH" })
    .errors(productErrors)
    .output(ProductEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await editProductContent(context.db, {
        actorUserId: context.authSession.user.id,
        description: input.description,
        expectedRevision: input.expectedRevision,
        imageUrls: input.imageUrls,
        name: input.name,
        organizationId: context.organization.id,
        productSlug: input.productSlug,
        slug: input.slug
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Product not found" });
      if (result.kind === "conflict") {
        throw errors.PRODUCT_CONFLICT({ data: { revision: result.revision } });
      }
      if (result.kind === "slug_taken") throw errors.PRODUCT_SLUG_TAKEN();
      return loadUpdatedEditor(context.db, {
        organizationId: context.organization.id,
        productId: result.id
      });
    }),
  editPricing: organizationActionProcedure(ProductEditPricingInputSchema, "product.price")
    .route({ description: "Edit all Product pricing", method: "PUT" })
    .errors(productErrors)
    .output(ProductEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await editProductPricing(context.db, {
        actorUserId: context.authSession.user.id,
        basePriceMinor: input.basePriceMinor,
        expectedRevision: input.expectedRevision,
        numericGroupPrices: input.numericGroupPrices,
        optionValuePrices: input.optionValuePrices,
        organizationId: context.organization.id,
        productSlug: input.productSlug
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Product not found" });
      if (result.kind === "conflict") {
        throw errors.PRODUCT_CONFLICT({ data: { revision: result.revision } });
      }
      if (result.kind === "invalid") {
        throw errors.PRODUCT_INVALID({ data: { issues: [...result.issues] } });
      }
      return loadUpdatedEditor(context.db, {
        organizationId: context.organization.id,
        productId: result.id
      });
    }),
  list: organizationActionProcedure(ProductListInputSchema, "product.manage")
    .route({ description: "List Products for editing", method: "GET" })
    .output(z.array(ProductListItemSchema))
    .handler(({ context }) =>
      listProducts(context.db, { organizationId: context.organization.id })
    ),
  preview: organizationActionProcedure(ProductPreviewInputSchema, "product.manage")
    .route({ description: "Preview a Product with the customer evaluator", method: "POST" })
    .output(ProductPreviewResultSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await context.db.transaction(
        async (tx) => {
          const editor = await loadProductEditor(tx, {
            organizationId: context.organization.id,
            productSlug: input.productSlug
          });
          if (!editor) return undefined;
          const parsed = parseProductEditorDefinition(editor);
          if (!parsed.success) return { issues: parsed.issues, kind: "incomplete" } as const;
          const availability = await loadProductAvailability(tx, {
            editor,
            organizationId: context.organization.id
          });
          return {
            evaluation: evaluateConfiguration({
              availability,
              currency: editor.currency,
              product: parsed.definition,
              quantity: input.quantity,
              selections: input.selections
            }),
            kind: "evaluation"
          } as const;
        },
        { accessMode: "read only", isolationLevel: "repeatable read" }
      );
      if (!result) throw errors.NOT_FOUND({ message: "Product not found" });
      return result;
    }),
  publish: organizationActionProcedure(ProductPublishInputSchema, "product.manage")
    .route({ description: "Publish a complete Product", method: "POST" })
    .errors(productErrors)
    .output(ProductEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await publishProduct(context.db, {
        actorUserId: context.authSession.user.id,
        expectedRevision: input.expectedRevision,
        organizationId: context.organization.id,
        productSlug: input.productSlug
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Product not found" });
      if (result.kind === "conflict") {
        throw errors.PRODUCT_CONFLICT({ data: { revision: result.revision } });
      }
      if (result.kind === "invalid") {
        throw errors.PRODUCT_INVALID({ data: { issues: result.issues } });
      }
      return loadUpdatedEditor(context.db, {
        organizationId: context.organization.id,
        productId: result.id
      });
    }),
  remove: organizationActionProcedure(ProductRemoveInputSchema, "product.delete")
    .route({
      description: "Delete an unreferenced Product or archive a referenced Product",
      method: "DELETE"
    })
    .errors(productErrors)
    .output(ProductRemoveResultSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await removeProduct(context.db, {
        actorUserId: context.authSession.user.id,
        expectedRevision: input.expectedRevision,
        organizationId: context.organization.id,
        productSlug: input.productSlug
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Product not found" });
      if (result.kind === "conflict") {
        throw errors.PRODUCT_CONFLICT({ data: { revision: result.revision } });
      }
      return { id: result.id, result: result.kind };
    })
};
