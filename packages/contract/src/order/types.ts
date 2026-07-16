import { z } from "zod";

import { PublicProductDefinitionSchema } from "@tsu-stack/contract/catalog";
import {
  MoneySchema,
  OptionGroupKeySchema,
  OptionValueIdSchema,
  PriceBreakdownLineSchema
} from "@tsu-stack/contract/configuration";
import {
  ConfigurationDraftDetailSchema,
  ConfigurationDraftProjectNameSchema
} from "@tsu-stack/contract/draft";
import { OrgSlugInputSchema } from "@tsu-stack/contract/organization";

const IdSchema = z.string().min(1);

export const OrderStatusSchema = z.enum([
  "placed",
  "confirmed",
  "in_production",
  "completed",
  "cancelled"
]);
export const OrderSortSchema = z.enum(["amount-asc", "amount-desc", "date-asc", "date-desc"]);

export const CancellationRequestStatusSchema = z.enum(["none", "pending", "approved", "rejected"]);

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
  cancellationStatus: CancellationRequestStatusSchema,
  createdAt: z.iso.datetime(),
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

export const OrderListResultSchema = z.object({
  counts: z.object({
    cancelled: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    confirmed: z.number().int().nonnegative(),
    inProduction: z.number().int().nonnegative(),
    placed: z.number().int().nonnegative()
  }),
  items: z.array(OrderListItemSchema),
  page: z.number().int().positive(),
  pageCount: z.number().int().nonnegative(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative()
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
export const OrderListInputSchema = OrgSlugInputSchema.extend({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).default(""),
  sort: OrderSortSchema.default("date-desc"),
  status: OrderStatusSchema.optional()
}).strict();
export const OrderByNumberInputSchema = OrgSlugInputSchema.extend({
  orderNumber: z.string().min(1)
});

export const OrderTransitionInputSchema = OrderByNumberInputSchema.extend({
  status: OrderStatusSchema
});

export const OrderCorrectProjectNameInputSchema = OrderByNumberInputSchema.extend({
  projectName: ConfigurationDraftProjectNameSchema
});

export const OrderRequestCancellationInputSchema = OrderByNumberInputSchema;

export const OrderDecideCancellationInputSchema = OrderByNumberInputSchema.extend({
  decision: z.enum(["approved", "rejected"])
});

export const OrderDuplicateToDraftInputSchema = OrderByNumberInputSchema;
export const OrderDuplicateToDraftOutputSchema = z.object({
  draft: ConfigurationDraftDetailSchema
});

export type OrderSnapshot = z.infer<typeof OrderSnapshotSchema>;
export type OrderSnapshotSelection = z.infer<typeof OrderSnapshotSelectionSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type CancellationRequestStatus = z.infer<typeof CancellationRequestStatusSchema>;
export type OrderDetail = z.infer<typeof OrderDetailSchema>;
export type OrderListItem = z.infer<typeof OrderListItemSchema>;
export type OrderListResult = z.infer<typeof OrderListResultSchema>;
export type OrderSort = z.infer<typeof OrderSortSchema>;
export type OrderPlaceInput = z.infer<typeof OrderPlaceInputSchema>;
export type OrderListInput = z.infer<typeof OrderListInputSchema>;
export type OrderByNumberInput = z.infer<typeof OrderByNumberInputSchema>;
export type OrderPriceChange = z.infer<typeof OrderPriceChangeSchema>;
export type OrderPriceComparison = z.infer<typeof OrderPriceComparisonSchema>;
export type OrderTransitionInput = z.infer<typeof OrderTransitionInputSchema>;
export type OrderCorrectProjectNameInput = z.infer<typeof OrderCorrectProjectNameInputSchema>;
export type OrderRequestCancellationInput = z.infer<typeof OrderRequestCancellationInputSchema>;
export type OrderDecideCancellationInput = z.infer<typeof OrderDecideCancellationInputSchema>;
export type OrderDuplicateToDraftInput = z.infer<typeof OrderDuplicateToDraftInputSchema>;
export type OrderDuplicateToDraftOutput = z.infer<typeof OrderDuplicateToDraftOutputSchema>;
