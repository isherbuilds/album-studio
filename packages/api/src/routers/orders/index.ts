import { z } from "zod";

import { PublicProductDefinitionSchema } from "@tsu-stack/contract/catalog";
import { ConfigurationIssueSchema } from "@tsu-stack/contract/configuration";
import {
  OrderByNumberInputSchema,
  OrderDetailSchema,
  OrderListInputSchema,
  OrderListItemSchema,
  OrderPlaceInputSchema,
  OrderPriceChangeSchema
} from "@tsu-stack/contract/order";
import { listOrders, loadOrderByNumber, placeOrder } from "@tsu-stack/core/order";

import { customerProcedure, organizationProcedure } from "#@/lib/procedures/factory";

export const ordersRouter = {
  byNumber: organizationProcedure(OrderByNumberInputSchema)
    .route({ description: "Load one Organization Order", method: "GET" })
    .output(OrderDetailSchema)
    .handler(async ({ context, errors, input }) => {
      const order = await loadOrderByNumber(context.db, {
        customerId: context.role === "customer" ? context.authSession.user.id : undefined,
        orderNumber: input.orderNumber,
        organizationId: context.organization.id
      });
      if (!order) throw errors.NOT_FOUND({ message: "Order not found" });
      return order;
    }),
  list: organizationProcedure(OrderListInputSchema)
    .route({ description: "List Organization Orders visible to current member", method: "GET" })
    .output(z.array(OrderListItemSchema))
    .handler(({ context }) =>
      listOrders(context.db, {
        customerId: context.role === "customer" ? context.authSession.user.id : undefined,
        organizationId: context.organization.id
      })
    ),
  place: customerProcedure(OrderPlaceInputSchema)
    .route({ description: "Reconcile and place one Configuration Draft", method: "POST" })
    .errors({
      CONFIGURATION_INVALID: {
        data: z.object({
          issues: z.array(ConfigurationIssueSchema).min(1),
          product: PublicProductDefinitionSchema
        }),
        message: "Configuration is no longer valid",
        status: 409
      },
      PRICE_CHANGED: {
        data: OrderPriceChangeSchema,
        message: "Order price changed",
        status: 409
      }
    })
    .output(OrderDetailSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await placeOrder(context.db, {
        acceptedPrice: input.acceptedPrice,
        customerId: context.authSession.user.id,
        draftId: input.draftId,
        organizationId: context.organization.id
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Draft not found" });
      if (result.kind === "configuration_invalid") {
        throw errors.CONFIGURATION_INVALID({
          data: { issues: result.issues, product: result.product }
        });
      }
      if (result.kind === "price_changed") {
        throw errors.PRICE_CHANGED({
          data: {
            current: result.current,
            previous: result.previous,
            product: result.product
          }
        });
      }
      return result.order;
    })
};
