import { useQuery } from "@tanstack/react-query";
import { Boxes, PackagePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { type ComponentAvailabilityStatus } from "@tsu-stack/contract/configuration";
import {
  type ComponentAvailabilityOverride,
  InventoryCreateComponentInputSchema,
  InventoryEditComponentInputSchema,
  InventoryRecordMovementInputSchema,
  InventorySetAvailabilityInputSchema
} from "@tsu-stack/contract/inventory";
import { m } from "@tsu-stack/i18n/messages";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tsu-stack/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@tsu-stack/ui/components/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle
} from "@tsu-stack/ui/components/empty";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tsu-stack/ui/components/tabs";
import { cn } from "@tsu-stack/ui/lib/utils";

import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceStatStrip
} from "@/components/admin/workspace";
import {
  type InventoryComponent,
  getInventoryListQueryOptions,
  getInventoryMovementsQueryOptions,
  useInventoryActions
} from "@/hooks/use-inventory";
import { getDateTimeFormatter, getNumberFormatter } from "@/lib/intl";

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

const createComponentFormSchema = InventoryCreateComponentInputSchema.pick({
  lowStockThreshold: true,
  name: true,
  unit: true
});

const recordMovementFormSchema = InventoryRecordMovementInputSchema.pick({
  delta: true,
  reason: true
});

const editComponentFormSchema = InventoryEditComponentInputSchema.pick({
  lowStockThreshold: true,
  name: true,
  unit: true
});

const setAvailabilityFormSchema = InventorySetAvailabilityInputSchema.pick({
  availabilityOverride: true
});

function availabilityLabel(value: ComponentAvailabilityOverride) {
  return availabilityOptions.find((option) => option.value === value)?.label();
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
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const parsed = createComponentFormSchema.safeParse(Object.fromEntries(data));
        if (!parsed.success) {
          toast.error(m.inventory__update_failed());
          return;
        }
        actions.createComponent.mutate(parsed.data, {
          onSuccess: (component) => {
            form.reset();
            onCreated(component);
            toast.success(m.inventory__created());
          }
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="inventory-new-name">{m.inventory__name()}</FieldLabel>
          <Input id="inventory-new-name" name="name" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
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
          {actions.createComponent.isPending ? m.inventory__adding() : m.inventory__add_action()}
        </Button>
      </FieldGroup>
    </form>
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
  const [activeTab, setActiveTab] = useState("movement");
  const movements = useQuery({
    ...getInventoryMovementsQueryOptions(organizationSlug, component.id),
    enabled: activeTab === "history"
  });
  const movementDateFormatter = getDateTimeFormatter(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  });
  const quantityFormatter = getNumberFormatter(locale, { maximumFractionDigits: 4 });
  const signedQuantityFormatter = getNumberFormatter(locale, {
    maximumFractionDigits: 4,
    signDisplay: "always"
  });

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="min-w-0">
            <h2 className="break-words">{component.name}</h2>
          </CardTitle>
          <StatusBadge status={component.effectiveAvailability} />
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t pt-4">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {m.inventory__on_hand()}
          </span>
          <strong className="min-w-0 text-right text-xl tabular-nums">
            {quantityFormatter.format(Number(component.quantity))}{" "}
            <span className="break-all">{component.unit}</span>
          </strong>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs onValueChange={setActiveTab} value={activeTab}>
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-none bg-muted/20 p-2">
            <TabsTrigger className="min-h-9 min-w-0 px-2 whitespace-normal" value="movement">
              {m.inventory__movement_tab()}
            </TabsTrigger>
            <TabsTrigger className="min-h-9 min-w-0 px-2 whitespace-normal" value="details">
              {m.inventory__details()}
            </TabsTrigger>
            <TabsTrigger className="min-h-9 min-w-0 px-2 whitespace-normal" value="history">
              {m.inventory__history_tab()}
            </TabsTrigger>
          </TabsList>

          <TabsContent className="flex flex-col gap-4 p-4 sm:p-6" keepMounted value="movement">
            <div>
              <h3 className="font-medium">{m.inventory__movement_title()}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.inventory__movement_description()}
              </p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const parsed = recordMovementFormSchema.safeParse(Object.fromEntries(data));
                if (!parsed.success) {
                  toast.error(m.inventory__update_failed());
                  return;
                }
                actions.recordMovement.mutate(
                  {
                    componentId: component.id,
                    ...parsed.data
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
          </TabsContent>

          <TabsContent
            className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6"
            keepMounted
            value="details"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const parsed = editComponentFormSchema.safeParse(Object.fromEntries(data));
                if (!parsed.success) {
                  toast.error(m.inventory__update_failed());
                  return;
                }
                actions.editComponent.mutate(
                  {
                    componentId: component.id,
                    ...parsed.data
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
                <div className="grid gap-4 sm:grid-cols-2">
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
                const parsed = setAvailabilityFormSchema.safeParse(Object.fromEntries(data));
                if (!parsed.success) {
                  toast.error(m.inventory__update_failed());
                  return;
                }
                actions.setAvailability.mutate(
                  {
                    componentId: component.id,
                    ...parsed.data
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
                    <SelectValue>{availabilityLabel}</SelectValue>
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
          </TabsContent>

          <TabsContent className="flex flex-col gap-3 p-4 sm:p-6" keepMounted value="history">
            <div>
              <h3 className="font-medium">{m.inventory__history()}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.inventory__history_description()}
              </p>
            </div>
            {movements.isPending ? (
              <div className="grid min-h-20 place-items-center">
                <Spinner />
              </div>
            ) : movements.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {m.inventory__history_load_failed()}
              </p>
            ) : movements.data?.length ? (
              <ol className="divide-y">
                {movements.data.map((movement) => (
                  <li className="flex items-start justify-between gap-4 py-3" key={movement.id}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">{movement.reason}</p>
                      <p className="text-xs break-words text-muted-foreground">
                        {movement.actorName} ·{" "}
                        {movementDateFormatter.format(new Date(movement.createdAt))}
                      </p>
                    </div>
                    <strong className="shrink-0 tabular-nums">
                      {signedQuantityFormatter.format(Number(movement.delta))}
                    </strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{m.inventory__no_movements()}</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function InventoryPage({ organizationSlug }: { organizationSlug: string }) {
  const componentsQuery = useQuery(getInventoryListQueryOptions(organizationSlug));
  const components = componentsQuery.data ?? [];
  const actions = useInventoryActions(organizationSlug);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    components.find((component) => component.id === selectedId) ?? components[0] ?? null;
  const counts = {
    available: components.filter((component) => component.effectiveAvailability === "available")
      .length,
    low: components.filter((component) => component.effectiveAvailability === "low").length,
    out: components.filter((component) => component.effectiveAvailability === "out").length
  };
  const { locale } = useLocale();
  const quantityFormatter = getNumberFormatter(locale, { maximumFractionDigits: 4 });

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        actions={
          <Dialog onOpenChange={setAddOpen} open={addOpen}>
            <DialogTrigger render={<Button />}>
              <PackagePlus data-icon="inline-start" />
              {m.inventory__add_title()}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{m.inventory__add_title()}</DialogTitle>
                <DialogDescription>{m.inventory__add_description()}</DialogDescription>
              </DialogHeader>
              <AddComponentForm
                actions={actions}
                onCreated={(component) => {
                  setSelectedId(component.id);
                  setAddOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        }
        description={m.inventory__description()}
        title={m.inventory__title()}
      />

      <WorkspaceStatStrip
        label={m.inventory__availability()}
        stats={[
          { id: "components", label: m.inventory__components(), value: components.length },
          {
            id: "available",
            label: m.inventory__available(),
            markerClassName: statusConfig.available.dotClass,
            value: counts.available
          },
          {
            id: "low",
            label: m.inventory__low(),
            markerClassName: statusConfig.low.dotClass,
            value: counts.low
          },
          {
            id: "out",
            label: m.inventory__out(),
            markerClassName: statusConfig.out.dotClass,
            value: counts.out
          }
        ]}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_27rem]">
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
            {componentsQuery.isPending ? (
              <output className="grid min-h-48 place-items-center">
                <Spinner aria-label={m.inventory__components()} />
              </output>
            ) : componentsQuery.isError ? (
              <Empty className="py-14" role="alert">
                <EmptyMedia variant="icon">
                  <Boxes />
                </EmptyMedia>
                <EmptyTitle>{m.inventory__update_failed()}</EmptyTitle>
                <EmptyContent>
                  <Button onClick={() => void componentsQuery.refetch()} variant="outline">
                    {m.error_500__try_again()}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : components.length === 0 ? (
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
                        className="grid min-h-18 w-full grid-cols-[0.25rem_minmax(0,1fr)_minmax(0,6rem)] items-center gap-4 px-4 py-3 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-current:bg-accent sm:px-6"
                        onClick={() => setSelectedId(component.id)}
                        type="button"
                      >
                        <span aria-hidden className={cn("h-10 rounded-full", config.dotClass)} />
                        <span className="min-w-0">
                          <strong className="block truncate">{component.name}</strong>
                          <span className="block truncate text-xs text-muted-foreground">
                            {config.label()} · {m.inventory__low_stock_threshold()}{" "}
                            {quantityFormatter.format(Number(component.lowStockThreshold))}
                          </span>
                        </span>
                        <span className="min-w-0 text-right">
                          <strong className="block truncate text-base tabular-nums">
                            {quantityFormatter.format(Number(component.quantity))}
                          </strong>
                          <span className="block truncate text-xs text-muted-foreground">
                            {component.unit}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <aside className="xl:sticky xl:top-6">
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
    </WorkspacePage>
  );
}
