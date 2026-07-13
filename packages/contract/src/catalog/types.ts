import { z } from "zod";

import {
  ComponentAvailabilitySchema,
  CurrencyCodeSchema,
  MinorUnitAmountSchema,
  ProductDefinitionSchema
} from "@tsu-stack/contract/configuration";
import { OrgSlugInputSchema } from "@tsu-stack/contract/organization";

export const PublicProductSummarySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  thumbnailUrl: z.string().nullable(),
  basePriceMinor: MinorUnitAmountSchema.nonnegative(),
  currency: CurrencyCodeSchema
});

/**
 * One complete curated product definition for the customer catalog (catalog.bySlug).
 * `definition` is the exact, branded evaluator input (`input.product`) — groups, values,
 * pricing, requirements and componentIds live inside it and must not be re-flattened.
 * `availability` MUST be a complete map: a status for EVERY componentId referenced by ANY
 * option value, or the evaluator throws on the missing entry.
 */
export const PublicProductDefinitionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  imageUrls: z.array(z.string()),
  currency: CurrencyCodeSchema,
  definition: ProductDefinitionSchema,
  availability: ComponentAvailabilitySchema
});

export const CatalogListInputSchema = OrgSlugInputSchema;

export const CatalogBySlugInputSchema = OrgSlugInputSchema.extend({
  productSlug: z.string().min(1)
});

export type PublicProductSummary = z.infer<typeof PublicProductSummarySchema>;
export type PublicProductDefinition = z.infer<typeof PublicProductDefinitionSchema>;
export type CatalogListInput = z.infer<typeof CatalogListInputSchema>;
export type CatalogBySlugInput = z.infer<typeof CatalogBySlugInputSchema>;
