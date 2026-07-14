import { z } from "zod";

import { PublicProductDefinitionSchema } from "@tsu-stack/contract/catalog";
import {
  MoneySchema,
  OptionGroupKeySchema,
  OptionValueIdSchema,
  PriceBreakdownLineSchema
} from "@tsu-stack/contract/configuration";
import { ConfigurationDraftProjectNameSchema } from "@tsu-stack/contract/draft";
import { OrgSlugInputSchema } from "@tsu-stack/contract/organization";

const IdSchema = z.string().min(1);

export const OrderStatusSchema = z.enum([
  "placed",
  "confirmed",
  "in_production",
  "completed",
  "cancelled"
]);

export const OrderSnapshotSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    componentIds: z.array(IdSchema),
    groupKey: OptionGroupKeySchema,
    groupLabel: z.string().min(1),
    kind: z.literal("option"),
    optionValueId: OptionValueIdSchema,
    optionValueLabel: z.string().min(1)
  }),
  z.object({
    groupKey: OptionGroupKeySchema,
    groupLabel: z.string().min(1),
    kind: z.literal("number"),
    selected: z.number().int()
  })
]);

export const OrderSnapshotSchema = z.object({
  orderTotal: MoneySchema,
  perUnitBreakdown: z.array(PriceBreakdownLineSchema),
  perUnitTotal: MoneySchema,
  product: z.object({ id: IdSchema, name: z.string().min(1), slug: IdSchema }),
  projectName: ConfigurationDraftProjectNameSchema,
  quantity: z.number().int().positive(),
  selections: z.array(OrderSnapshotSelectionSchema)
});

export const OrderDetailSchema = z.object({
  createdAt: z.string().datetime(),
  number: z.string().min(1),
  projectName: ConfigurationDraftProjectNameSchema,
  snapshot: OrderSnapshotSchema,
  status: OrderStatusSchema
});

export const OrderListItemSchema = OrderDetailSchema.pick({
  createdAt: true,
  number: true,
  projectName: true,
  status: true
}).extend({
  orderTotal: MoneySchema,
  productName: z.string().min(1),
  quantity: z.number().int().positive()
});

export const OrderPriceComparisonSchema = z.object({
  orderTotal: MoneySchema,
  perUnitBreakdown: z.array(PriceBreakdownLineSchema),
  perUnitTotal: MoneySchema
});

export const OrderPriceChangeSchema = z.object({
  current: OrderPriceComparisonSchema,
  previous: OrderPriceComparisonSchema,
  product: PublicProductDefinitionSchema
});

export const OrderPlaceInputSchema = OrgSlugInputSchema.extend({
  acceptedPrice: OrderPriceComparisonSchema,
  draftId: IdSchema
});
export const OrderListInputSchema = OrgSlugInputSchema;
export const OrderByNumberInputSchema = OrgSlugInputSchema.extend({
  orderNumber: z.string().min(1)
});

export type OrderSnapshot = z.infer<typeof OrderSnapshotSchema>;
export type OrderDetail = z.infer<typeof OrderDetailSchema>;
export type OrderListItem = z.infer<typeof OrderListItemSchema>;
export type OrderPlaceInput = z.infer<typeof OrderPlaceInputSchema>;
export type OrderPriceChange = z.infer<typeof OrderPriceChangeSchema>;
export type OrderPriceComparison = z.infer<typeof OrderPriceComparisonSchema>;
