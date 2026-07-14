import { type PublicProductDefinition } from "@tsu-stack/contract/catalog";
import {
  type ConfigurationDraftSnapshot,
  type ConfigurationDraftState
} from "@tsu-stack/contract/draft";

import { evaluateConfiguration } from "#@/configuration/evaluate-configuration";
import { normalizeConfigurationDraftStep } from "#@/draft/step";

export function createConfigurationDraftSnapshot(
  product: PublicProductDefinition,
  state: ConfigurationDraftState
): ConfigurationDraftSnapshot {
  const evaluationInput = {
    availability: product.availability,
    currency: product.currency,
    product: product.definition,
    quantity: state.quantity,
    selections: state.selections
  };
  const initial = evaluateConfiguration(evaluationInput);
  const selectionKeys = Object.keys(state.selections);
  const evaluation =
    selectionKeys.length === Object.keys(initial.normalizedSelections).length &&
    selectionKeys.every((key) => state.selections[key] === initial.normalizedSelections[key])
      ? initial
      : evaluateConfiguration({ ...evaluationInput, selections: initial.normalizedSelections });

  return {
    evaluationSummary:
      evaluation.status === "valid"
        ? {
            status: "valid",
            orderTotal: evaluation.orderTotal,
            perUnitBreakdown: evaluation.perUnitBreakdown,
            perUnitTotal: evaluation.perUnitTotal
          }
        : { status: "invalid", issues: evaluation.issues },
    projectName: state.projectName,
    quantity: state.quantity,
    selections: evaluation.normalizedSelections,
    step: normalizeConfigurationDraftStep(state.step, product.definition)
  };
}
