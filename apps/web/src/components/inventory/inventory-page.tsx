import { Boxes, History, PackagePlus, Scale } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type ComponentAvailabilityStatus } from "@tsu-stack/contract/configuration";
import {
  type ComponentAvailabilityOverride,
  ComponentAvailabilityOverrideSchema
} from "@tsu-stack/contract/inventory";
import { m } from "@tsu-stack/i18n/messages";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@tsu-stack/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@tsu-stack/ui/components/select";
import { Separator } from "@tsu-stack/ui/components/separator";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import { cn } from "@tsu-stack/ui/lib/utils";

import {
  type InventoryComponent,
  useInventoryActions,
  useInventoryListQuery,
  useInventoryMovementsQuery
} from "@/hooks/use-inventory";

const statusConfig: Record<ComponentAvailabilityStatus, { dotClass: string; label: () => string }> =
  {
    available: { dotClass: "bg-success", label: m.inventory__available },
    low: { dotClass: "bg-warning", label: m.inventory__low },
    out: { dotClass: "bg-destructive", label: m.inventory__out }
  };

const availabilityOptions: ReadonlyArray<{
  label: () => string;
  value: ComponentAvailabilityOverride;
}> = [
  { label: m.inventory__automatic, value: "automatic" },
  { label: m.inventory__available, value: "available" },
  { label: m.inventory__low, value: "low" },
  { label: m.inventory__out, value: "out" }
];

function formText(data: FormData, key: string) {
  const value = data.get(key);
  if (typeof value !== "string") throw new Error(`Expected text form field: ${key}`);
  return value;
}

function StatusBadge({ status }: { status: ComponentAvailabilityStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline">
      <span aria-hidden className={cn("size-1.5 rounded-full", config.dotClass)} />
      {config.label()}
    </Badge>
  );
}

function AddComponentForm({
  actions,
  onCreated
}: {
  actions: ReturnType<typeof useInventoryActions>;
  onCreated: (component: InventoryComponent) => void;
}) {
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <PackagePlus />
          <h2>{m.inventory__add_title()}</h2>
        </CardTitle>
        <CardDescription>{m.inventory__add_description()}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            actions.createComponent.mutate(
              {
                lowStockThreshold: formText(data, "lowStockThreshold"),
                name: formText(data, "name"),
                unit: formText(data, "unit")
              },
              {
                onSuccess: (component) => {
                  form.reset();
                  onCreated(component);
                  toast.success(m.inventory__created());
                }
              }
            );
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="inventory-new-name">{m.inventory__name()}</FieldLabel>
              <Input id="inventory-new-name" name="name" required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Field>
                <FieldLabel htmlFor="inventory-new-unit">{m.inventory__unit()}</FieldLabel>
                <Input id="inventory-new-unit" name="unit" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="inventory-new-threshold">
                  {m.inventory__low_stock_threshold()}
                </FieldLabel>
                <Input
                  defaultValue="0"
                  id="inventory-new-threshold"
                  inputMode="decimal"
                  min="0"
                  name="lowStockThreshold"
                  required
                  step="0.0001"
                  type="number"
                />
              </Field>
            </div>
            <Button disabled={actions.createComponent.isPending} type="submit">
              {actions.createComponent.isPending
                ? m.inventory__adding()
                : m.inventory__add_action()}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function ComponentInspector({
  actions,
  component,
  organizationSlug
}: {
  actions: ReturnType<typeof useInventoryActions>;
  component: InventoryComponent;
  organizationSlug: string;
}) {
  const { locale } = useLocale();
  const movements = useInventoryMovementsQuery(organizationSlug, component.id);

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>
              <h2>{component.name}</h2>
            </CardTitle>
            <CardDescription>{m.inventory__edit_description()}</CardDescription>
          </div>
          <StatusBadge status={component.effectiveAvailability} />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4 rounded-lg bg-muted/50 p-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {m.inventory__on_hand()}
          </span>
          <strong className="text-xl tabular-nums">
            {component.quantity} {component.unit}
          </strong>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            actions.editComponent.mutate(
              {
                componentId: component.id,
                lowStockThreshold: formText(data, "lowStockThreshold"),
                name: formText(data, "name"),
                unit: formText(data, "unit")
              },
              { onSuccess: () => toast.success(m.inventory__saved()) }
            );
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`inventory-name-${component.id}`}>
                {m.inventory__name()}
              </FieldLabel>
              <Input
                defaultValue={component.name}
                id={`inventory-name-${component.id}`}
                name="name"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Field>
                <FieldLabel htmlFor={`inventory-unit-${component.id}`}>
                  {m.inventory__unit()}
                </FieldLabel>
                <Input
                  defaultValue={component.unit}
                  id={`inventory-unit-${component.id}`}
                  name="unit"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`inventory-threshold-${component.id}`}>
                  {m.inventory__low_stock_threshold()}
                </FieldLabel>
                <Input
                  defaultValue={component.lowStockThreshold}
                  id={`inventory-threshold-${component.id}`}
                  inputMode="decimal"
                  min="0"
                  name="lowStockThreshold"
                  required
                  step="0.0001"
                  type="number"
                />
              </Field>
            </div>
            <Button disabled={actions.editComponent.isPending} type="submit" variant="outline">
              {actions.editComponent.isPending ? m.inventory__saving() : m.inventory__save()}
            </Button>
          </FieldGroup>
        </form>

        <Separator />

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            actions.setAvailability.mutate(
              {
                availabilityOverride: ComponentAvailabilityOverrideSchema.parse(
                  formText(data, "availabilityOverride")
                ),
                componentId: component.id
              },
              { onSuccess: () => toast.success(m.inventory__availability_saved()) }
            );
          }}
        >
          <Field>
            <FieldLabel htmlFor={`inventory-availability-${component.id}`}>
              {m.inventory__availability()}
            </FieldLabel>
            <Select defaultValue={component.availabilityOverride} name="availabilityOverride">
              <SelectTrigger className="w-full" id={`inventory-availability-${component.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availabilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button disabled={actions.setAvailability.isPending} type="submit" variant="outline">
            {actions.setAvailability.isPending
              ? m.inventory__setting_availability()
              : m.inventory__set_availability()}
          </Button>
        </form>

        <Separator />

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-medium">
              <Scale />
              {m.inventory__movement_title()}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {m.inventory__movement_description()}
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              actions.recordMovement.mutate(
                {
                  componentId: component.id,
                  delta: formText(data, "delta"),
                  reason: formText(data, "reason")
                },
                {
                  onSuccess: () => {
                    form.reset();
                    toast.success(m.inventory__movement_recorded());
                  }
                }
              );
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`inventory-delta-${component.id}`}>
                  {m.inventory__delta()}
                </FieldLabel>
                <Input
                  id={`inventory-delta-${component.id}`}
                  inputMode="decimal"
                  name="delta"
                  required
                  step="0.0001"
                  type="number"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`inventory-reason-${component.id}`}>
                  {m.inventory__reason()}
                </FieldLabel>
                <Input id={`inventory-reason-${component.id}`} name="reason" required />
              </Field>
              <Button disabled={actions.recordMovement.isPending} type="submit">
                {actions.recordMovement.isPending
                  ? m.inventory__recording()
                  : m.inventory__record_movement()}
              </Button>
            </FieldGroup>
          </form>
        </section>

        <Separator />

        <section
          className="flex flex-col gap-3"
          aria-labelledby={`inventory-history-${component.id}`}
        >
          <div>
            <h3
              className="flex items-center gap-2 font-medium"
              id={`inventory-history-${component.id}`}
            >
              <History />
              {m.inventory__history()}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {m.inventory__history_description()}
            </p>
          </div>
          {movements.isPending ? (
            <div className="grid min-h-20 place-items-center">
              <Spinner />
            </div>
          ) : movements.data?.length ? (
            <ol className="divide-y">
              {movements.data.map((movement) => (
                <li className="flex items-start justify-between gap-4 py-3" key={movement.id}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{movement.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {movement.actorName} · {new Date(movement.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                  <strong className="shrink-0 tabular-nums">
                    {movement.delta.startsWith("-") ? movement.delta : `+${movement.delta}`}
                  </strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{m.inventory__no_movements()}</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

export function InventoryPage({ organizationSlug }: { organizationSlug: string }) {
  const components = useInventoryListQuery(organizationSlug).data ?? [];
  const actions = useInventoryActions(organizationSlug);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    components.find((component) => component.id === selectedId) ?? components[0] ?? null;
  const counts = {
    available: components.filter((component) => component.effectiveAvailability === "available")
      .length,
    low: components.filter((component) => component.effectiveAvailability === "low").length,
    out: components.filter((component) => component.effectiveAvailability === "out").length
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col gap-2 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {m.inventory__title()}
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">{m.inventory__description()}</p>
      </header>

      <section className="grid grid-cols-3 gap-3" aria-label={m.inventory__availability()}>
        {(["available", "low", "out"] as const).map((status) => (
          <Card className="gap-2 p-4" key={status} size="sm">
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", statusConfig[status].dotClass)}
              />
              {statusConfig[status].label()}
            </span>
            <strong className="text-2xl tabular-nums">{counts[status]}</strong>
          </Card>
        ))}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <Card className="py-0" size="sm">
          <CardHeader className="border-b py-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Boxes />
                <h2>{m.inventory__components()}</h2>
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {m.inventory__component_count({ count: components.length })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {components.length === 0 ? (
              <Empty className="py-14">
                <EmptyMedia variant="icon">
                  <Boxes />
                </EmptyMedia>
                <EmptyTitle>{m.inventory__empty_title()}</EmptyTitle>
                <EmptyDescription>{m.inventory__empty_description()}</EmptyDescription>
              </Empty>
            ) : (
              <ul className="divide-y">
                {components.map((component) => {
                  const config = statusConfig[component.effectiveAvailability];
                  return (
                    <li key={component.id}>
                      <button
                        aria-label={`${component.name}, ${config.label()}, ${component.quantity} ${component.unit}`}
                        aria-current={selected?.id === component.id ? "true" : undefined}
                        className="grid w-full grid-cols-[0.25rem_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-current:bg-muted/60 sm:px-5"
                        onClick={() => setSelectedId(component.id)}
                        type="button"
                      >
                        <span aria-hidden className={cn("h-12 rounded-full", config.dotClass)} />
                        <span className="min-w-0">
                          <strong className="block truncate">{component.name}</strong>
                          <span className="text-xs text-muted-foreground">
                            {config.label()} · {m.inventory__low_stock_threshold()}{" "}
                            {component.lowStockThreshold}
                          </span>
                        </span>
                        <span className="text-right">
                          <strong className="block text-base tabular-nums">
                            {component.quantity}
                          </strong>
                          <span className="text-xs text-muted-foreground">{component.unit}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-6">
          <AddComponentForm
            actions={actions}
            onCreated={(component) => setSelectedId(component.id)}
          />
          {selected ? (
            <ComponentInspector
              actions={actions}
              component={selected}
              key={selected.id}
              organizationSlug={organizationSlug}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
