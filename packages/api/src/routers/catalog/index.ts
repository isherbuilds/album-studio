import { z } from "zod";

import {
  CatalogBySlugInputSchema,
  CatalogListInputSchema,
  PublicProductDefinitionSchema,
  PublicProductSummarySchema
} from "@tsu-stack/contract/catalog";
import {
  listPublishedProductSummaries,
  loadPublicProductDefinition
} from "@tsu-stack/core/catalog";

import { customerProcedure } from "#@/lib/procedures/factory";

export const catalogRouter = {
  list: customerProcedure(CatalogListInputSchema)
    .route({ description: "List an organization's published catalog products", method: "GET" })
    .output(z.array(PublicProductSummarySchema))
    .handler(({ context }) =>
      listPublishedProductSummaries(context.db, {
        organizationId: context.organization.id
      })
    ),
  bySlug: customerProcedure(CatalogBySlugInputSchema)
    .route({ description: "Get a published catalog product by slug", method: "GET" })
    .output(PublicProductDefinitionSchema)
    .handler(async ({ context, errors, input }) => {
      const definition = await loadPublicProductDefinition(context.db, {
        organizationId: context.organization.id,
        productSlug: input.productSlug
      });
      if (!definition) throw errors.NOT_FOUND({ message: "Product not found" });
      return definition;
    })
};
