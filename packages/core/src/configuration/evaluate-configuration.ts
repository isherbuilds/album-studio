import {
  type ConfigurationEvaluation,
  type ConfigurationIssue,
  type ConfigurationSelections,
  type DisabledOptionExplanation,
  type DisabledOptionReason,
  type EvaluateConfigurationInput,
  type PriceBreakdownLine
} from "@tsu-stack/contract/configuration";

/**
 * Evaluates a configuration against its authoritative Product definition.
 *
 * `input.availability` MUST contain an own entry for every Component referenced
 * by any Option Value in any group — including values that are not selected.
 * A missing entry throws, because availability is authoritative and a silently
 * absent Component must never be treated as orderable.
 */
export function evaluateConfiguration(input: EvaluateConfigurationInput): ConfigurationEvaluation {
  const selectionEntries = Object.entries(input.selections);
  selectionEntries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const normalizedSelections: ConfigurationSelections = Object.fromEntries(selectionEntries);
  const issues: ConfigurationIssue[] = [];
  const disabledExplanations: DisabledOptionExplanation[] = [];
  const perUnitBreakdown: PriceBreakdownLine[] = [
    { kind: "base", amountMinor: input.product.basePriceMinor }
  ];
  const productGroupKeys = new Set(input.product.groups.map((group) => group.key));

  for (const groupKey of Object.keys(normalizedSelections)) {
    if (!productGroupKeys.has(groupKey)) {
      delete normalizedSelections[groupKey];
      issues.push({
        code: "unknown_group",
        location: { kind: "group", groupKey },
        params: { groupKey }
      });
    }
  }

  let perUnitTotal = input.product.basePriceMinor;

  for (const group of input.product.groups) {
    const selection = normalizedSelections[group.key];

    if (selection === undefined && group.required) {
      issues.push({
        code: "missing_selection",
        location: { kind: "group", groupKey: group.key },
        params: { label: group.label }
      });
    }

    if (group.type === "number") {
      if (selection === undefined) {
        continue;
      }

      if (typeof selection !== "number" || !Number.isSafeInteger(selection)) {
        delete normalizedSelections[group.key];
        issues.push({
          code: "invalid_selection_type",
          location: { kind: "group", groupKey: group.key },
          params: { expected: "safe_integer", received: typeof selection }
        });
        continue;
      }

      if (selection < group.minimum || selection > group.maximum) {
        issues.push({
          code: "number_out_of_range",
          location: { kind: "group", groupKey: group.key },
          params: {
            maximum: group.maximum,
            minimum: group.minimum,
            selected: selection
          }
        });
        continue;
      }

      if ((selection - group.minimum) % group.step !== 0) {
        issues.push({
          code: "number_step_mismatch",
          location: { kind: "group", groupKey: group.key },
          params: {
            minimum: group.minimum,
            selected: selection,
            step: group.step
          }
        });
        continue;
      }

      const additionalUnits = Math.max(0, selection - group.included);
      const amountMinor = additionalUnits * group.additionalUnitPriceMinor;
      if (!Number.isSafeInteger(amountMinor)) {
        issues.push({
          code: "money_overflow",
          location: { kind: "group", groupKey: group.key },
          params: { operation: "number_price" }
        });
        continue;
      }

      const nextPerUnitTotal = perUnitTotal + amountMinor;
      if (!Number.isSafeInteger(nextPerUnitTotal)) {
        issues.push({
          code: "money_overflow",
          location: { kind: "group", groupKey: group.key },
          params: { operation: "per_unit_sum" }
        });
        continue;
      }

      perUnitBreakdown.push({
        kind: "number",
        groupKey: group.key,
        selected: selection,
        additionalUnits,
        unitPriceMinor: group.additionalUnitPriceMinor,
        amountMinor
      });
      perUnitTotal = nextPerUnitTotal;
      continue;
    }

    let selectedReasons: DisabledOptionReason[] | undefined;
    let selectedValue: (typeof group.values)[number] | undefined;
    for (const value of group.values) {
      const reasons: DisabledOptionReason[] = [];

      for (const requirement of value.requirements) {
        const prerequisiteSelection = normalizedSelections[requirement.groupKey];
        if (
          typeof prerequisiteSelection !== "string" ||
          !requirement.optionValueIds.includes(prerequisiteSelection)
        ) {
          reasons.push({
            code: "requirement_unmet",
            params: { groupKey: requirement.groupKey }
          });
        }
      }

      for (const componentId of value.componentIds) {
        if (!Object.hasOwn(input.availability, componentId)) {
          throw new Error(`Missing availability for Component ${componentId}`);
        }
        if (input.availability[componentId] === "out") {
          reasons.push({
            code: "component_unavailable",
            params: { componentId }
          });
        }
      }

      reasons.sort((left, right) => {
        if (left.code !== right.code) return left.code === "requirement_unmet" ? -1 : 1;
        const leftKey = String(
          left.params[left.code === "requirement_unmet" ? "groupKey" : "componentId"]
        );
        const rightKey = String(
          right.params[right.code === "requirement_unmet" ? "groupKey" : "componentId"]
        );
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      });

      if (reasons.length > 0) {
        disabledExplanations.push({
          groupKey: group.key,
          optionValueId: value.id,
          reasons
        });
      }
      if (selection === value.id) {
        selectedValue = value;
        if (reasons.length > 0) selectedReasons = reasons;
      }
    }

    if (selection === undefined) {
      continue;
    }

    if (typeof selection !== "string") {
      delete normalizedSelections[group.key];
      issues.push({
        code: "invalid_selection_type",
        location: { kind: "group", groupKey: group.key },
        params: { expected: "option_value_id", received: typeof selection }
      });
      continue;
    }

    if (!selectedValue) {
      delete normalizedSelections[group.key];
      issues.push({
        code: "unknown_selection",
        location: { kind: "group", groupKey: group.key },
        params: { optionValueId: selection }
      });
      continue;
    }

    if (selectedReasons) {
      delete normalizedSelections[group.key];

      for (const reason of selectedReasons) {
        if (reason.code === "requirement_unmet") {
          issues.push({
            code: "selection_invalidated",
            location: { kind: "group", groupKey: group.key },
            params: reason.params
          });
        } else if (reason.code === "component_unavailable") {
          issues.push({
            code: "component_unavailable",
            location: { kind: "group", groupKey: group.key },
            params: { ...reason.params, optionValueId: selectedValue.id }
          });
        }
      }
      continue;
    }

    const nextPerUnitTotal = perUnitTotal + selectedValue.priceAdjustmentMinor;
    if (!Number.isSafeInteger(nextPerUnitTotal)) {
      issues.push({
        code: "money_overflow",
        location: { kind: "group", groupKey: group.key },
        params: { operation: "per_unit_sum" }
      });
      continue;
    }

    perUnitBreakdown.push({
      kind: "option",
      groupKey: group.key,
      optionValueId: selectedValue.id,
      amountMinor: selectedValue.priceAdjustmentMinor
    });
    perUnitTotal = nextPerUnitTotal;
  }

  const quantityValid = Number.isSafeInteger(input.quantity) && input.quantity > 0;
  if (!quantityValid) {
    issues.push({
      code: "quantity_invalid",
      location: { kind: "quantity" },
      params: {
        quantity: Number.isFinite(input.quantity) ? input.quantity : String(input.quantity)
      }
    });
  }

  const orderTotal = perUnitTotal * input.quantity;
  if (quantityValid && !Number.isSafeInteger(orderTotal)) {
    issues.push({
      code: "money_overflow",
      location: { kind: "quantity" },
      params: { operation: "order_total" }
    });
  }

  if (issues.length > 0) {
    return {
      status: "invalid",
      normalizedSelections,
      issues,
      disabledExplanations
    };
  }

  return {
    status: "valid",
    normalizedSelections,
    perUnitBreakdown,
    perUnitTotal: { amountMinor: perUnitTotal, currency: input.currency },
    orderTotal: { amountMinor: orderTotal, currency: input.currency },
    disabledExplanations
  };
}
