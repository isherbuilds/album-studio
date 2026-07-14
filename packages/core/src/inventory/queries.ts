import { type ComponentAvailabilityStatus } from "@tsu-stack/contract/configuration";
import { type component } from "@tsu-stack/db/schema";

export function computeEffectiveAvailability(
  input: Pick<
    typeof component.$inferSelect,
    "availabilityOverride" | "lowStockThreshold" | "quantity"
  >
): ComponentAvailabilityStatus {
  if (input.availabilityOverride !== "automatic") return input.availabilityOverride;
  const quantity = Number(input.quantity);
  const threshold = Number(input.lowStockThreshold);
  if (quantity <= 0) return "out";
  if (quantity <= threshold) return "low";
  return "available";
}
