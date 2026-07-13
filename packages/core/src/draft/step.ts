import { type ProductDefinition } from "@tsu-stack/contract/configuration";
import { type ConfigurationDraftStep } from "@tsu-stack/contract/draft";

export function normalizeConfigurationDraftStep(
  step: ConfigurationDraftStep,
  product: ProductDefinition
): ConfigurationDraftStep {
  if (step.kind === "review" || product.groups.some((group) => group.key === step.groupKey)) {
    return step;
  }

  const firstGroup = product.groups[0];
  return firstGroup ? { kind: "group", groupKey: firstGroup.key } : { kind: "review" };
}
