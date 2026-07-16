import { type OrderStatus } from "#@/order/types";

const ORDER_STATUS_TRANSITIONS = {
  cancelled: [],
  completed: [],
  confirmed: ["in_production", "cancelled"],
  in_production: ["completed", "cancelled"],
  placed: ["confirmed", "cancelled"]
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_STATUS_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);
}

export function nextOrderStatus(status: OrderStatus): OrderStatus | undefined {
  return ORDER_STATUS_TRANSITIONS[status].find((candidate) => candidate !== "cancelled");
}
