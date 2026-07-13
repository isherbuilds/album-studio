import { type EvaluateConfigurationInput } from "@tsu-stack/contract/configuration";
import { type ConfigurationDraftSnapshot } from "@tsu-stack/contract/draft";

import { evaluateConfiguration } from "#@/configuration/evaluate-configuration";

export function createConfigurationDraftSnapshot(
  input: EvaluateConfigurationInput & Pick<ConfigurationDraftSnapshot, "projectName" | "step">
): ConfigurationDraftSnapshot {
  const initial = evaluateConfiguration(input);
  const selectionKeys = Object.keys(input.selections);
  const evaluation =
    selectionKeys.length === Object.keys(initial.normalizedSelections).length &&
    selectionKeys.every((key) => input.selections[key] === initial.normalizedSelections[key])
      ? initial
      : evaluateConfiguration({ ...input, selections: initial.normalizedSelections });

  return {
    evaluationSummary:
      evaluation.status === "valid"
        ? { status: "valid", orderTotal: evaluation.orderTotal }
        : { status: "invalid", issues: evaluation.issues },
    projectName: input.projectName,
    quantity: input.quantity,
    selections: evaluation.normalizedSelections,
    step: input.step
  };
}
