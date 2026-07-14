import { PlayCircle } from "lucide-react";
import { useState } from "react";

import {
  type ConfigurationIssueCode,
  type ConfigurationSelections,
  type DisabledOptionReasonCode
} from "@tsu-stack/contract/configuration";
import { type ProductEditor, type ProductPreviewResult } from "@tsu-stack/contract/product";
import { m } from "@tsu-stack/i18n/messages";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Alert, AlertDescription, AlertTitle } from "@tsu-stack/ui/components/alert";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import { Field, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@tsu-stack/ui/components/select";
import { Separator } from "@tsu-stack/ui/components/separator";

import { formatIssuePath, formatMinor } from "./format";

const NONE = "__none__";

const issueCodeLabel: Record<ConfigurationIssueCode, () => string> = {
  component_unavailable: m.products__issue_component_unavailable,
  invalid_selection_type: m.products__issue_invalid_selection_type,
  missing_selection: m.products__issue_missing_selection,
  money_overflow: m.products__issue_money_overflow,
  number_out_of_range: m.products__issue_number_out_of_range,
  number_step_mismatch: m.products__issue_number_step_mismatch,
  quantity_invalid: m.products__issue_quantity_invalid,
  selection_invalidated: m.products__issue_selection_invalidated,
  unknown_group: m.products__issue_unknown_group,
  unknown_selection: m.products__issue_unknown_selection
};

const reasonCodeLabel: Record<DisabledOptionReasonCode, () => string> = {
  component_unavailable: m.products__reason_component_unavailable,
  requirement_unmet: m.products__reason_requirement_unmet
};

export function ProductPreview({
  editor,
  isError,
  isPreviewing,
  onPreview,
  result
}: {
  editor: ProductEditor;
  isError: boolean;
  isPreviewing: boolean;
  onPreview: (input: { quantity: number; selections: ConfigurationSelections }) => void;
  result: ProductPreviewResult | undefined;
}) {
  const { locale } = useLocale();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  const groupLabel = (groupKey: string) =>
    editor.groups.find((group) => group.key === groupKey)?.label ?? groupKey;

  const run = () => {
    const built: ConfigurationSelections = {};
    for (const group of editor.groups) {
      const raw = selections[group.key];
      if (group.type === "number") {
        if (raw !== undefined && raw !== "") built[group.key] = Number(raw);
      } else if (raw !== undefined && raw !== NONE && raw !== "") {
        built[group.key] = raw;
      }
    }
    onPreview({ quantity, selections: built });
  };

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <PlayCircle />
          <h2>{m.products__preview_title()}</h2>
        </CardTitle>
        <CardDescription>{m.products__preview_description()}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {editor.groups.map((group) => {
            const controlId = `preview-${group.key}`;
            if (group.type === "number") {
              return (
                <Field key={group.key}>
                  <FieldLabel htmlFor={controlId}>
                    {group.label}
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({group.minimum}–{group.maximum}, ×{group.step})
                    </span>
                  </FieldLabel>
                  <Input
                    id={controlId}
                    inputMode="numeric"
                    max={group.maximum}
                    min={group.minimum}
                    onChange={(event) =>
                      setSelections((prev) => {
                        return { ...prev, [group.key]: event.target.value };
                      })
                    }
                    placeholder={String(group.included)}
                    step={group.step}
                    type="number"
                    value={selections[group.key] ?? ""}
                  />
                </Field>
              );
            }
            return (
              <Field key={group.key}>
                <FieldLabel htmlFor={controlId}>{group.label}</FieldLabel>
                <Select
                  onValueChange={(value) =>
                    setSelections((prev) => {
                      return { ...prev, [group.key]: value ?? NONE };
                    })
                  }
                  value={selections[group.key] ?? NONE}
                >
                  <SelectTrigger className="w-full" id={controlId}>
                    <SelectValue>
                      {(selectedValue: string) =>
                        selectedValue === NONE
                          ? m.products__select_none()
                          : (group.values.find((value) => value.id === selectedValue)?.label ??
                            m.products__select_none())
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NONE}>{m.products__select_none()}</SelectItem>
                      {group.values.map((value) => (
                        <SelectItem key={value.id} value={value.id}>
                          {value.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            );
          })}

          <Field className="max-w-32">
            <FieldLabel htmlFor="preview-quantity">{m.products__quantity()}</FieldLabel>
            <Input
              id="preview-quantity"
              inputMode="numeric"
              min={1}
              onChange={(event) => setQuantity(Number.parseInt(event.target.value, 10) || 1)}
              type="number"
              value={quantity}
            />
          </Field>

          <Button className="self-start" disabled={isPreviewing} onClick={run} type="button">
            {isPreviewing ? m.products__previewing() : m.products__run_preview()}
          </Button>
        </div>

        <Separator />

        <PreviewResult groupLabel={groupLabel} isError={isError} locale={locale} result={result} />
      </CardContent>
    </Card>
  );
}

function PreviewResult({
  groupLabel,
  isError,
  locale,
  result
}: {
  groupLabel: (groupKey: string) => string;
  isError: boolean;
  locale: string;
  result: ProductPreviewResult | undefined;
}) {
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{m.products__preview_failed()}</AlertTitle>
      </Alert>
    );
  }
  if (result === undefined) {
    return <p className="text-sm text-muted-foreground">{m.products__preview_none()}</p>;
  }
  if (result.kind === "incomplete") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{m.products__preview_incomplete()}</AlertTitle>
        <AlertDescription>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {result.issues.map((issue, index) => (
              <li key={`${formatIssuePath(issue.path)}-${index}`}>
                <span className="font-medium text-foreground">{formatIssuePath(issue.path)}</span>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  const evaluation = result.evaluation;
  if (evaluation.status === "valid") {
    const currency = evaluation.perUnitTotal.currency;
    return (
      <div className="flex flex-col gap-3">
        <Badge className="w-fit" variant="outline">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          {m.products__preview_valid()}
        </Badge>
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">{m.products__per_unit_total()}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatMinor(evaluation.perUnitTotal.amountMinor, currency, locale)}
            </dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">{m.products__order_total()}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {formatMinor(
                evaluation.orderTotal.amountMinor,
                evaluation.orderTotal.currency,
                locale
              )}
            </dd>
          </div>
        </dl>
        <ul className="divide-y text-sm">
          {evaluation.perUnitBreakdown.map((line, index) => (
            <li className="flex justify-between gap-4 py-1.5" key={index}>
              <span className="text-muted-foreground">
                {line.kind === "base"
                  ? m.products__base_price()
                  : line.kind === "option"
                    ? `${groupLabel(line.groupKey)} · ${line.optionValueId}`
                    : `${groupLabel(line.groupKey)} · +${line.additionalUnits}`}
              </span>
              <span className="tabular-nums">
                {formatMinor(line.amountMinor, currency, locale)}
              </span>
            </li>
          ))}
        </ul>
        {evaluation.disabledExplanations.length > 0 ? (
          <DisabledList explanations={evaluation.disabledExplanations} groupLabel={groupLabel} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Badge className="w-fit" variant="outline">
        <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
        {m.products__preview_invalid()}
      </Badge>
      <ul className="flex flex-col gap-2">
        {evaluation.issues.map((issue, index) => (
          <li className="text-sm" key={`${issue.code}-${index}`}>
            <span className="font-medium">{issueCodeLabel[issue.code]()}</span>
            <span className="text-muted-foreground">
              {" — "}
              {issue.location.kind === "group"
                ? m.products__issue_group({ group: groupLabel(issue.location.groupKey) })
                : m.products__issue_quantity_location()}
            </span>
          </li>
        ))}
      </ul>
      {evaluation.disabledExplanations.length > 0 ? (
        <DisabledList explanations={evaluation.disabledExplanations} groupLabel={groupLabel} />
      ) : null}
    </div>
  );
}

function DisabledList({
  explanations,
  groupLabel
}: {
  explanations: Extract<
    ProductPreviewResult,
    { kind: "evaluation" }
  >["evaluation"]["disabledExplanations"];
  groupLabel: (groupKey: string) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium">{m.products__disabled_options()}</p>
      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        {explanations.map((explanation) => (
          <li key={`${explanation.groupKey}-${explanation.optionValueId}`}>
            {groupLabel(explanation.groupKey)} · {explanation.optionValueId} —{" "}
            {explanation.reasons.map((reason) => reasonCodeLabel[reason.code]()).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
