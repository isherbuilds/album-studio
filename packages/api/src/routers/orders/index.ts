import { z } from "zod";

import { PublicProductDefinitionSchema } from "@tsu-stack/contract/catalog";
import { ConfigurationIssueSchema } from "@tsu-stack/contract/configuration";
import {
  OrderByNumberInputSchema,
  OrderCorrectProjectNameInputSchema,
  OrderDecideCancellationInputSchema,
  OrderDetailSchema,
  OrderDuplicateToDraftInputSchema,
  OrderDuplicateToDraftOutputSchema,
  OrderListInputSchema,
  OrderListItemSchema,
  OrderPlaceInputSchema,
  OrderPriceChangeSchema,
  OrderRequestCancellationInputSchema,
  OrderTransitionInputSchema
} from "@tsu-stack/contract/order";
import {
  correctOrderProjectName,
  decideOrderCancellation,
  duplicateOrderToDraft,
  listOrders,
  loadOrderByNumber,
  placeOrder,
  requestOrderCancellation,
  transitionOrder
} from "@tsu-stack/core/order";

import {
  customerProcedure,
  organizationActionProcedure,
  organizationProcedure
} from "#@/lib/procedures/factory";

const orderManagementErrors = {
  INVALID_ORDER_TRANSITION: {
    message: "Order cannot move from its current state",
    status: 409
  }
} as const;

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
  correctProjectName: organizationActionProcedure(
    OrderCorrectProjectNameInputSchema,
    "order.manage"
  )
    .route({ description: "Correct an Order Project Name", method: "POST" })
    .output(OrderDetailSchema)
    .handler(async ({ context, errors, input }) => {
      const order = await correctOrderProjectName(context.db, {
        actorUserId: context.authSession.user.id,
        orderNumber: input.orderNumber,
        organizationId: context.organization.id,
        projectName: input.projectName
      });
      if (!order) throw errors.NOT_FOUND({ message: "Order not found" });
      return order;
    }),
  decideCancellation: organizationActionProcedure(
    OrderDecideCancellationInputSchema,
    "order.manage"
  )
    .route({ description: "Approve or reject an Order cancellation request", method: "POST" })
    .errors(orderManagementErrors)
    .output(OrderDetailSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await decideOrderCancellation(context.db, {
        actorUserId: context.authSession.user.id,
        decision: input.decision,
        orderNumber: input.orderNumber,
        organizationId: context.organization.id
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Order not found" });
      if (result.kind === "invalid_transition") throw errors.INVALID_ORDER_TRANSITION();
      return result.order;
    }),
  duplicateToDraft: customerProcedure(OrderDuplicateToDraftInputSchema)
    .route({ description: "Duplicate an Order into a new Configuration Draft", method: "POST" })
    .output(OrderDuplicateToDraftOutputSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await duplicateOrderToDraft(context.db, {
        customerId: context.authSession.user.id,
        orderNumber: input.orderNumber,
        organizationId: context.organization.id
      });
      if (!result) throw errors.NOT_FOUND({ message: "Order not found" });
      return result;
    }),
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
    }),
  requestCancellation: customerProcedure(OrderRequestCancellationInputSchema)
    .route({ description: "Request cancellation of a placed Order", method: "POST" })
    .errors(orderManagementErrors)
    .output(OrderDetailSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await requestOrderCancellation(context.db, {
        customerId: context.authSession.user.id,
        orderNumber: input.orderNumber,
        organizationId: context.organization.id
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Order not found" });
      if (result.kind === "invalid_transition") throw errors.INVALID_ORDER_TRANSITION();
      return result.order;
    }),
  transition: organizationActionProcedure(OrderTransitionInputSchema, "order.manage")
    .route({ description: "Progress or cancel an Order", method: "POST" })
    .errors(orderManagementErrors)
    .output(OrderDetailSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await transitionOrder(context.db, {
        actorUserId: context.authSession.user.id,
        orderNumber: input.orderNumber,
        organizationId: context.organization.id,
        status: input.status
      });
      if (result.kind === "not_found") throw errors.NOT_FOUND({ message: "Order not found" });
      if (result.kind === "invalid_transition") throw errors.INVALID_ORDER_TRANSITION();
      return result.order;
    })
};
