import { useHydrated } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, ImageOff, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type Ref } from "react";

import { type PublicProductDefinition } from "@tsu-stack/contract/catalog";
import {
  type ConfigurationEvaluation,
  type ConfigurationSelections,
  type ConfigurationSelectionValue,
  type DisabledOptionReason,
  type ProductDefinition,
  type ProductOptionGroup
} from "@tsu-stack/contract/configuration";
import { type ConfigurationDraftState } from "@tsu-stack/contract/draft";
import { type OrderPriceChange, type OrderPriceComparison } from "@tsu-stack/contract/order";
import { evaluateConfiguration } from "@tsu-stack/core/configuration";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Alert, AlertDescription, AlertTitle } from "@tsu-stack/ui/components/alert";
import { Button } from "@tsu-stack/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tsu-stack/ui/components/card";
import { Field, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Separator } from "@tsu-stack/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@tsu-stack/ui/components/sheet";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import { Stepper as WizardStepper, type StepperStep } from "@tsu-stack/ui/components/stepper";
import { cn } from "@tsu-stack/ui/lib/utils";

import { formatMinorAmount, labelForGroup, labelForOption } from "@/components/catalog/format";
import { PriceSummary } from "@/components/catalog/price-summary";
import { Image } from "@/components/common/image";

export type DraftCheckpointStatus = "conflict" | "dirty" | "error" | "saved" | "saving";
export type DraftSnapshotPatch = Partial<ConfigurationDraftState>;

type DisabledMap = Map<string, Map<string, DisabledOptionReason[]>>;

const listFormatterByLocale = new Map<string, Intl.ListFormat>();

function guidanceForEvaluation(
  evaluation: ConfigurationEvaluation,
  product: ProductDefinition
): string | undefined {
  if (evaluation.status === "valid") return undefined;
  const issue = evaluation.issues.find(
    (candidate) =>
      candidate.code === "missing_selection" ||
      candidate.code === "number_out_of_range" ||
      candidate.code === "number_step_mismatch"
  );
  if (!issue || issue.location.kind !== "group") return undefined;
  const { groupKey } = issue.location;
  const group = product.groups.find((item) => item.key === groupKey);
  if (issue.code === "missing_selection") {
    return m.catalog__select_option({ group: labelForGroup(product.groups, groupKey) });
  }
  if (group?.type === "number") {
    return m.catalog__range_hint({
      maximum: group.maximum,
      minimum: group.minimum,
      step: group.step
    });
  }
  return undefined;
}

function disabledReasonText(
  reason: DisabledOptionReason,
  product: ProductDefinition,
  locale: string
): string {
  if (reason.code === "component_unavailable") return m.catalog__out_of_stock();
  const groupKey = String(reason.params.groupKey);
  const optionValueIds = reason.params.optionValueIds;
  const labels = Array.isArray(optionValueIds)
    ? optionValueIds.map((id) => labelForOption(product.groups, groupKey, id))
    : [labelForGroup(product.groups, groupKey)];
  let formatter = listFormatterByLocale.get(locale);
  if (!formatter) {
    formatter = new Intl.ListFormat(locale, { style: "long", type: "disjunction" });
    listFormatterByLocale.set(locale, formatter);
  }
  return m.catalog__requires({
    values: formatter.format(labels)
  });
}

function OptionButton({
  disabledReasons,
  imageUrl,
  label,
  locale,
  onSelect,
  price,
  product,
  selected,
  showImageSlot
}: {
  disabledReasons: DisabledOptionReason[] | undefined;
  imageUrl: string | null | undefined;
  label: string;
  locale: string;
  onSelect: () => void;
  price: string;
  product: ProductDefinition;
  selected: boolean;
  showImageSlot: boolean;
}) {
  const disabledLabels = disabledReasons
    ? [...new Set(disabledReasons.map((reason) => disabledReasonText(reason, product, locale)))]
    : [];
  const disabled = disabledLabels.length > 0;
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-2 text-left text-sm outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/5 dark:bg-primary/10"
          : "border-input hover:bg-accent",
        disabled && "cursor-not-allowed border-dashed opacity-60 hover:bg-transparent"
      )}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      {showImageSlot ? (
        <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-muted">
          {imageUrl ? (
            <Image
              alt=""
              className="size-full object-cover"
              height={150}
              src={imageUrl}
              width={200}
            />
          ) : (
            <ImageOff aria-hidden className="size-5 text-muted-foreground/50" />
          )}
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5 px-1">
        <span className="font-medium">{label}</span>
        {disabled ? (
          <span className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {disabledLabels.map((reason) => (
              <span key={reason}>{reason}</span>
            ))}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{price}</span>
        )}
      </div>
    </button>
  );
}

function DiscreteGroup({
  currency,
  disabledMap,
  group,
  locale,
  onSelect,
  product,
  selection
}: {
  currency: string;
  disabledMap: DisabledMap;
  group: Extract<ProductOptionGroup, { type: "single" | "boolean" }>;
  locale: string;
  onSelect: (value: string) => void;
  product: ProductDefinition;
  selection: ConfigurationSelectionValue | undefined;
}) {
  const showImageSlot = group.values.some((value) => value.imageUrl != null);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">
        {group.label}
        {group.required ? <span className="text-destructive"> *</span> : null}
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {group.values.map((value) => (
          <OptionButton
            disabledReasons={disabledMap.get(group.key)?.get(value.id)}
            imageUrl={value.imageUrl}
            key={value.id}
            label={value.label}
            locale={locale}
            onSelect={() => onSelect(value.id)}
            price={
              value.priceAdjustmentMinor === 0
                ? m.catalog__included()
                : `+${formatMinorAmount(value.priceAdjustmentMinor, currency, locale)}`
            }
            product={product}
            selected={selection === value.id}
            showImageSlot={showImageSlot}
          />
        ))}
      </div>
    </fieldset>
  );
}

function NumberStepper({
  ariaLabel,
  max,
  min,
  onChange,
  onIncompleteChange,
  step,
  value
}: {
  ariaLabel: string;
  max?: number;
  min: number;
  onChange: (value: number) => void;
  onIncompleteChange: () => void;
  step: number;
  value: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = String(value);
    }
  }, [value]);

  const clamp = (next: number) => {
    const bounded = max === undefined ? next : Math.min(next, max);
    return Math.max(bounded, min);
  };

  const normalize = (next: number) => clamp(min + Math.round((clamp(next) - min) / step) * step);

  const commit = (next: number) => {
    const normalized = normalize(next);
    if (inputRef.current) inputRef.current.value = String(normalized);
    onChange(normalized);
  };

  return (
    <div className="flex w-fit items-center gap-1">
      <Button
        aria-label={m.catalog__decrease()}
        disabled={value <= min}
        onClick={() => commit(value - step)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Minus />
      </Button>
      <Input
        aria-label={ariaLabel}
        className="w-16 text-center tabular-nums"
        defaultValue={value}
        inputMode="numeric"
        max={max}
        min={min}
        onChange={(event) => {
          const next = event.currentTarget.value;
          const parsed = Number(next);
          if (next.trim() === "" || !Number.isFinite(parsed)) {
            onIncompleteChange();
            return;
          }
          onChange(parsed);
        }}
        onBlur={(event) => {
          const next = event.currentTarget.value;
          const parsed = Number(next);
          if (next.trim() === "" || Number.isNaN(parsed)) {
            event.currentTarget.value = String(value);
            return;
          }
          commit(parsed);
        }}
        ref={inputRef}
        step={step}
        type="number"
      />
      <Button
        aria-label={m.catalog__increase()}
        disabled={max !== undefined && value >= max}
        onClick={() => commit(value + step)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Plus />
      </Button>
    </div>
  );
}

function NumberGroup({
  currency,
  group,
  locale,
  onChange,
  onIncompleteChange,
  value
}: {
  currency: string;
  group: Extract<ProductOptionGroup, { type: "number" }>;
  locale: string;
  onChange: (value: number) => void;
  onIncompleteChange: () => void;
  value: number;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">
        {group.label}
        {group.required ? <span className="text-destructive"> *</span> : null}
      </legend>
      <NumberStepper
        ariaLabel={group.label}
        max={group.maximum}
        min={group.minimum}
        onChange={onChange}
        onIncompleteChange={onIncompleteChange}
        step={group.step}
        value={value}
      />
      <p className="text-xs text-muted-foreground">
        {m.catalog__per_additional({
          included: group.included,
          price: formatMinorAmount(group.additionalUnitPriceMinor, currency, locale)
        })}
      </p>
    </fieldset>
  );
}

function selectedOptionImage(
  group: ProductOptionGroup | undefined,
  selections: ConfigurationSelections
): string | null {
  if (!group || group.type === "number") return null;
  const selected = selections[group.key];
  if (typeof selected !== "string") return null;
  return group.values.find((value) => value.id === selected)?.imageUrl ?? null;
}

function EstimatePanel({
  currency,
  evaluation,
  guidance,
  isPlacing,
  isSaving,
  locale,
  onPlaceOrder,
  priceChange,
  product,
  quantity
}: {
  currency: string;
  evaluation: ConfigurationEvaluation;
  guidance: string | undefined;
  isPlacing: boolean;
  isSaving: boolean;
  locale: string;
  onPlaceOrder: (acceptedPrice: OrderPriceComparison) => void;
  priceChange: OrderPriceChange | null;
  product: ProductDefinition;
  quantity: number;
}) {
  return (
    <>
      <PriceSummary
        currency={currency}
        evaluation={evaluation}
        locale={locale}
        product={product}
        quantity={quantity}
      />
      {guidance ? <p className="text-sm text-muted-foreground">{guidance}</p> : null}
      {priceChange ? (
        <Alert>
          <AlertTitle>{m.orders__price_changed()}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>{m.orders__price_changed_description()}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{m.orders__previous_total()}</dt>
                <dd className="font-medium tabular-nums">
                  {formatMinorAmount(
                    priceChange.previous.orderTotal.amountMinor,
                    priceChange.previous.orderTotal.currency,
                    locale
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{m.orders__current_total()}</dt>
                <dd className="font-medium tabular-nums">
                  {formatMinorAmount(
                    priceChange.current.orderTotal.amountMinor,
                    priceChange.current.orderTotal.currency,
                    locale
                  )}
                </dd>
              </div>
            </dl>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              {[priceChange.previous, priceChange.current].map((comparison, index) => (
                <ul className="flex flex-col gap-1" key={index === 0 ? "previous" : "current"}>
                  {comparison.perUnitBreakdown.map((line, lineIndex) => (
                    <li className="flex justify-between gap-2" key={`${line.kind}-${lineIndex}`}>
                      <span>
                        {line.kind === "base"
                          ? m.catalog__base_price()
                          : line.kind === "option"
                            ? labelForOption(product.groups, line.groupKey, line.optionValueId)
                            : labelForGroup(product.groups, line.groupKey)}
                      </span>
                      <span className="tabular-nums">
                        {formatMinorAmount(
                          line.amountMinor,
                          comparison.perUnitTotal.currency,
                          locale
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
            <Button
              disabled={isPlacing || isSaving}
              onClick={() => onPlaceOrder(priceChange.current)}
              type="button"
            >
              {isPlacing ? <Spinner data-icon="inline-start" /> : null}
              {m.orders__accept_price_and_place()}
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Button
          className="w-full"
          disabled={evaluation.status !== "valid" || isPlacing || isSaving}
          onClick={() => {
            if (evaluation.status === "valid") {
              onPlaceOrder({
                orderTotal: evaluation.orderTotal,
                perUnitBreakdown: evaluation.perUnitBreakdown,
                perUnitTotal: evaluation.perUnitTotal
              });
            }
          }}
          type="button"
        >
          {isPlacing ? <Spinner data-icon="inline-start" /> : null}
          {isPlacing ? m.orders__placing() : m.catalog__place_order()}
        </Button>
      )}
    </>
  );
}

function DraftSaveState({
  busy,
  conflictReloadFailed,
  onAcceptServer,
  onOverwriteLocal,
  onSaveChanges,
  status
}: {
  busy: boolean;
  conflictReloadFailed: boolean;
  onAcceptServer: () => void;
  onOverwriteLocal: () => void;
  onSaveChanges: () => void;
  status: DraftCheckpointStatus;
}) {
  const label =
    status === "saved"
      ? m.drafts__save_saved()
      : status === "dirty"
        ? m.drafts__save_pending()
        : status === "saving"
          ? m.drafts__save_saving()
          : status === "error"
            ? m.drafts__save_failed()
            : m.drafts__save_conflict();

  return (
    <div className="flex max-w-md flex-col items-start gap-2 sm:items-end">
      <output
        aria-live="polite"
        className="flex min-h-8 items-center gap-2 text-sm text-muted-foreground"
      >
        <span
          aria-hidden
          className={cn(
            "grid size-5 place-items-center rounded-full border",
            status === "saved" && "border-foreground bg-foreground text-background",
            (status === "dirty" || status === "saving") && "border-muted-foreground",
            (status === "error" || status === "conflict") && "border-destructive text-destructive"
          )}
        >
          {status === "saved" ? <Check className="size-3" /> : null}
        </span>
        <span className={cn((status === "error" || status === "conflict") && "text-destructive")}>
          {label}
        </span>
      </output>
      <Button
        disabled={busy || status === "saved" || status === "saving" || status === "conflict"}
        onClick={onSaveChanges}
        size="sm"
        type="button"
        variant="outline"
      >
        {status === "saving" ? m.drafts__save_saving() : m.drafts__save_changes()}
      </Button>
      {status === "conflict" ? (
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-sm text-muted-foreground">{m.drafts__save_conflict_description()}</p>
          {conflictReloadFailed ? (
            <p className="text-sm text-destructive" role="alert">
              {m.drafts__load_saved_failed()}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={onAcceptServer}
              size="sm"
              type="button"
              variant="outline"
            >
              {m.drafts__load_saved_version()}
            </Button>
            <Button disabled={busy} onClick={onOverwriteLocal} size="sm" type="button">
              {m.drafts__save_my_version()}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DraftConfigurator({
  checkoutError,
  conflictReloadFailed,
  isPlacing,
  isSaving,
  onAcceptServer,
  onOverwriteLocal,
  onPlaceOrder,
  onSaveChanges,
  onSnapshotChange,
  onStepTransition,
  organizationSlug,
  payload,
  priceChange,
  projectNameInputRef,
  saveStatus,
  snapshot
}: {
  checkoutError: "failed" | "invalid" | null;
  conflictReloadFailed: boolean;
  isPlacing: boolean;
  isSaving: boolean;
  onAcceptServer: () => void;
  onOverwriteLocal: () => void;
  onPlaceOrder: (acceptedPrice: OrderPriceComparison) => void;
  onSaveChanges: () => void;
  onSnapshotChange: (patch: DraftSnapshotPatch) => void;
  onStepTransition: (snapshot: ConfigurationDraftState) => Promise<boolean>;
  organizationSlug: string;
  payload: PublicProductDefinition;
  priceChange: OrderPriceChange | null;
  projectNameInputRef: Ref<HTMLInputElement>;
  saveStatus: DraftCheckpointStatus;
  snapshot: ConfigurationDraftState;
}) {
  const { locale } = useLocale();
  const isHydrated = useHydrated();
  const product = payload.definition;
  const currency = payload.currency;
  const availability = payload.availability;
  const { quantity, selections } = snapshot;

  const evaluation = evaluateConfiguration({
    product,
    availability,
    currency,
    selections,
    quantity
  });

  const handleSelect = (groupKey: string, value: ConfigurationSelectionValue) => {
    const next = evaluateConfiguration({
      product,
      availability,
      currency,
      selections: { ...selections, [groupKey]: value },
      quantity
    });
    onSnapshotChange({ selections: next.normalizedSelections });
  };

  const disabledMap: DisabledMap = new Map();
  for (const explanation of evaluation.disabledExplanations) {
    let group = disabledMap.get(explanation.groupKey);
    if (!group) {
      group = new Map();
      disabledMap.set(explanation.groupKey, group);
    }
    group.set(explanation.optionValueId, explanation.reasons);
  }

  const groups = product.groups;
  const reviewStep = groups.length;
  const stepCount = groups.length + 1;
  const draftStep = snapshot.step;
  const activeStep =
    draftStep.kind === "review"
      ? reviewStep
      : groups.findIndex((group) => group.key === draftStep.groupKey);
  if (activeStep < 0) throw new Error("Draft step references an unavailable product group");

  const [maxStepReached, setMaxStepReached] = useState(activeStep);
  const maxReachableStep = Math.max(maxStepReached, activeStep);

  const blockedGroupKeys = new Set<string>();
  if (evaluation.status === "invalid") {
    for (const issue of evaluation.issues) {
      if (issue.location.kind === "group") blockedGroupKeys.add(issue.location.groupKey);
    }
  }

  const stepStatusFor = (index: number, blocked: boolean): StepperStep["status"] => {
    if (index === activeStep) return "current";
    if (blocked) return "invalid";
    if (index <= maxReachableStep) return "complete";
    return "upcoming";
  };

  const railSteps: StepperStep[] = [
    ...groups.map((group, index) => {
      return {
        id: group.key,
        ariaLabel: m.catalog__step_label({ label: group.label, step: index + 1 }),
        label: group.label,
        status: stepStatusFor(index, blockedGroupKeys.has(group.key))
      };
    }),
    {
      id: "review",
      ariaLabel: m.catalog__step_label({ label: m.catalog__review(), step: reviewStep + 1 }),
      label: m.catalog__review(),
      status: stepStatusFor(reviewStep, evaluation.status !== "valid")
    }
  ];

  const currentBlocked = activeStep < reviewStep && blockedGroupKeys.has(groups[activeStep].key);

  const transitionTo = async (index: number) => {
    if (index < 0 || index > reviewStep || index === activeStep || isSaving) return;
    const nextSnapshot: ConfigurationDraftState = {
      ...snapshot,
      step:
        index === reviewStep ? { kind: "review" } : { kind: "group", groupKey: groups[index].key }
    };
    const transitioned = await onStepTransition(nextSnapshot);
    if (transitioned) {
      setMaxStepReached((reached) => Math.max(reached, activeStep, index));
    }
  };
  const goToStep = (index: number) => {
    if (index <= maxReachableStep) void transitionTo(index);
  };
  const goNext = async () => {
    if (activeStep >= reviewStep || currentBlocked) return;
    const next = activeStep + 1;
    await transitionTo(next);
  };
  const goBack = () => void transitionTo(Math.max(0, activeStep - 1));

  const firstFailingStep = groups.findIndex((group) => blockedGroupKeys.has(group.key));

  const guidance = guidanceForEvaluation(evaluation, product);
  const activeGroup = activeStep < reviewStep ? groups[activeStep] : undefined;
  const activeSelection = activeGroup ? selections[activeGroup.key] : undefined;

  const heroSrc =
    selectedOptionImage(activeGroup, selections) ??
    groups.map((group) => selectedOptionImage(group, selections)).find(Boolean) ??
    payload.imageUrls[0] ??
    null;

  const orderTotalLabel =
    evaluation.status === "valid"
      ? formatMinorAmount(evaluation.orderTotal.amountMinor, currency, locale)
      : "—";

  return (
    <div aria-busy={!isHydrated || isSaving} className="mx-auto max-w-7xl p-5 pb-24 sm:p-8 lg:pb-8">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <header className="flex flex-col gap-3">
            <Link
              className="-ml-1 flex w-fit items-center gap-1 rounded-md py-0.5 pr-2 pl-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              params={{ organizationSlug }}
              to="/org/$organizationSlug/drafts"
            >
              <ChevronLeft className="size-4" />
              {m.drafts__back_to_drafts()}
            </Link>
            <div className="grid items-end gap-4 border-b pb-5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Field>
                <FieldLabel htmlFor="draft-project-name">{m.drafts__project_name()}</FieldLabel>
                <Input
                  id="draft-project-name"
                  className="max-w-xl text-base font-medium"
                  disabled={!isHydrated || isSaving}
                  maxLength={120}
                  onChange={(event) => {
                    const projectName = event.currentTarget.value;
                    onSnapshotChange({ projectName: projectName === "" ? null : projectName });
                  }}
                  placeholder={m.drafts__project_name_placeholder()}
                  ref={projectNameInputRef}
                  value={snapshot.projectName ?? ""}
                />
              </Field>
              <DraftSaveState
                busy={!isHydrated || isSaving}
                conflictReloadFailed={conflictReloadFailed}
                onAcceptServer={onAcceptServer}
                onOverwriteLocal={onOverwriteLocal}
                onSaveChanges={onSaveChanges}
                status={saveStatus}
              />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{payload.name}</h1>
              {payload.description ? (
                <p className="text-sm text-muted-foreground">{payload.description}</p>
              ) : null}
            </div>
          </header>

          {heroSrc ? (
            <div className="aspect-[16/9] overflow-hidden rounded-xl bg-muted">
              <Image
                alt={payload.name}
                className="size-full object-cover"
                height={576}
                key={heroSrc}
                src={heroSrc}
                width={1024}
              />
            </div>
          ) : null}

          <Card inert={!isHydrated || isSaving}>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">
                    {activeGroup ? activeGroup.label : m.catalog__review()}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {m.catalog__step_of({ current: activeStep + 1, total: stepCount })}
                  </span>
                </div>
                <WizardStepper
                  isStepSelectable={(index) => index <= maxReachableStep}
                  onStepSelect={goToStep}
                  steps={railSteps}
                />
              </div>

              <Separator />

              {checkoutError ? (
                <Alert variant="destructive">
                  <AlertTitle>
                    {checkoutError === "invalid"
                      ? m.orders__configuration_invalid()
                      : m.orders__placement_failed()}
                  </AlertTitle>
                  <AlertDescription>
                    {checkoutError === "invalid"
                      ? m.orders__configuration_invalid_description()
                      : m.orders__placement_failed_description()}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-6" key={activeStep}>
                {activeGroup ? (
                  activeGroup.type === "number" ? (
                    <NumberGroup
                      currency={currency}
                      group={activeGroup}
                      locale={locale}
                      onChange={(value) => handleSelect(activeGroup.key, value)}
                      onIncompleteChange={() => onSnapshotChange({})}
                      value={
                        typeof activeSelection === "number" ? activeSelection : activeGroup.included
                      }
                    />
                  ) : (
                    <DiscreteGroup
                      currency={currency}
                      disabledMap={disabledMap}
                      group={activeGroup}
                      locale={locale}
                      onSelect={(value) => handleSelect(activeGroup.key, value)}
                      product={product}
                      selection={activeSelection}
                    />
                  )
                ) : (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-base font-medium">{m.catalog__review()}</h2>
                      <p className="text-sm text-muted-foreground">
                        {m.catalog__review_description()}
                      </p>
                    </div>
                    <fieldset className="flex flex-col gap-2">
                      <legend className="text-sm font-medium">{m.catalog__quantity()}</legend>
                      <NumberStepper
                        ariaLabel={m.catalog__quantity()}
                        min={1}
                        onChange={(value) => onSnapshotChange({ quantity: value })}
                        onIncompleteChange={() => onSnapshotChange({})}
                        step={1}
                        value={quantity}
                      />
                    </fieldset>
                    {evaluation.status !== "valid" ? (
                      <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <p className="text-sm">{guidance ?? m.catalog__review_incomplete()}</p>
                        {firstFailingStep >= 0 ? (
                          <Button
                            onClick={() => goToStep(firstFailingStep)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {m.catalog__fix_step({ step: groups[firstFailingStep].label })}
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{m.catalog__review_ready()}</p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-3">
                <Button
                  disabled={activeStep === 0 || isSaving}
                  onClick={goBack}
                  type="button"
                  variant="outline"
                >
                  <ChevronLeft />
                  {m.catalog__back()}
                </Button>
                {activeStep < reviewStep ? (
                  <Button disabled={currentBlocked || isSaving} onClick={goNext} type="button">
                    {m.catalog__next()}
                    <ChevronRight />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Desktop sticky estimate */}
        <Card className="top-20 hidden lg:sticky lg:flex">
          <CardHeader>
            <CardTitle>{m.catalog__summary_title()}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <EstimatePanel
              currency={currency}
              evaluation={evaluation}
              guidance={guidance}
              isPlacing={isPlacing}
              isSaving={isSaving}
              locale={locale}
              onPlaceOrder={onPlaceOrder}
              priceChange={priceChange}
              product={product}
              quantity={quantity}
            />
          </CardContent>
        </Card>
      </div>

      {/* Mobile fixed bottom bar + estimate sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-4 lg:hidden"
        inert={!isHydrated || isSaving}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{m.catalog__order_total()}</span>
            <span className="text-lg font-semibold tabular-nums">{orderTotalLabel}</span>
          </div>
          <Sheet
            defaultOpen={priceChange !== null}
            key={priceChange ? JSON.stringify(priceChange.current) : (checkoutError ?? "ready")}
          >
            <SheetTrigger asChild>
              <Button type="button" variant="outline">
                {m.catalog__view_summary()}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{m.catalog__summary_title()}</SheetTitle>
                <SheetDescription>{m.catalog__summary_description()}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 p-4 pt-0">
                <EstimatePanel
                  currency={currency}
                  evaluation={evaluation}
                  guidance={guidance}
                  isPlacing={isPlacing}
                  isSaving={isSaving}
                  locale={locale}
                  onPlaceOrder={onPlaceOrder}
                  priceChange={priceChange}
                  product={product}
                  quantity={quantity}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
