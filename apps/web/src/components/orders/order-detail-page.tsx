import { useHydrated, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  CircleAlert,
  CopyPlus,
  ReceiptText,
  RotateCcw
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { nextOrderStatus, type OrderStatus } from "@tsu-stack/contract/order";
import { type OrganizationRole } from "@tsu-stack/contract/organization";
import { type OfflinePaymentMethod, OfflinePaymentMethodSchema } from "@tsu-stack/contract/payment";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
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
import { Field, FieldGroup, FieldLabel } from "@tsu-stack/ui/components/field";
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
import { Spinner } from "@tsu-stack/ui/components/spinner";

import { WorkspacePage, WorkspacePageHeader } from "@/components/admin/workspace";
import {
  formatOrderDate,
  formatOrderDateTime,
  orderStatusConfig,
  orderStatusLabel
} from "@/components/orders/order-format";
import { useOrderActions, useOrderByNumberQuery } from "@/hooks/use-orders";
import { usePaymentActions, usePaymentLedgerQuery } from "@/hooks/use-payments";
import { formatMinorAmount, parseMajorAmount } from "@/lib/money";

const productionSteps: OrderStatus[] = ["placed", "confirmed", "in_production", "completed"];
const recordPaymentSchema = z.object({
  amount: z.string(),
  method: OfflinePaymentMethodSchema,
  note: z.string()
});

const reversePaymentSchema = z.object({
  amount: z.string(),
  note: z.string()
});

function paymentMethodLabel(method: OfflinePaymentMethod) {
  switch (method) {
    case "cash":
      return m.payments__method_cash();
    case "bank_transfer":
      return m.payments__method_bank_transfer();
    case "upi":
      return m.payments__method_upi();
    case "cheque":
      return m.payments__method_cheque();
    case "other":
      return m.payments__method_other();
  }
}

export function OrderDetailPage({
  orderNumber,
  organizationRole,
  organizationSlug
}: {
  orderNumber: string;
  organizationRole: OrganizationRole;
  organizationSlug: string;
}) {
  const navigate = useNavigate();
  const isHydrated = useHydrated();
  const [projectNameInput, setProjectNameInput] = useState<string | undefined>(undefined);
  const { locale } = useLocale();
  const order = useOrderByNumberQuery(organizationSlug, orderNumber).data;
  const ledger = usePaymentLedgerQuery(organizationSlug, orderNumber).data;
  const actions = useOrderActions(organizationSlug, orderNumber);
  const paymentActions = usePaymentActions(organizationSlug, orderNumber);
  if (!order || !ledger) return null;

  const currency = order.snapshot.orderTotal.currency;
  const format = (amountMinor: number) => formatMinorAmount(amountMinor, currency, locale);
  const staff = organizationRole === "owner" || organizationRole === "manager";
  const ordersPath = "/$organizationSlug/orders";
  const next = nextOrderStatus(order.status);
  const busy =
    !isHydrated ||
    actions.transition.isPending ||
    actions.correctProjectName.isPending ||
    actions.requestCancellation.isPending ||
    actions.decideCancellation.isPending;

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = recordPaymentSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) {
      toast.error(m.payments__invalid_amount());
      return;
    }
    const amountMinor = parseMajorAmount(parsed.data.amount, currency, locale, {
      minimumMinor: 1
    });
    if (!amountMinor) {
      toast.error(m.payments__invalid_amount());
      return;
    }
    paymentActions.record.mutate(
      {
        amountMinor,
        method: parsed.data.method,
        mutationId: crypto.randomUUID(),
        note: parsed.data.note
      },
      { onSuccess: () => form.reset() }
    );
  };

  return (
    <WorkspacePage className="max-w-6xl">
      <Link
        className="flex w-fit items-center gap-1 rounded-lg text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        params={{ organizationSlug }}
        to={ordersPath}
      >
        <ChevronLeft />
        {m.orders__back()}
      </Link>

      <WorkspacePageHeader
        actions={
          <Badge variant="outline">
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${orderStatusConfig[order.status].dotClass}`}
            />
            {orderStatusLabel(order.status)}
          </Badge>
        }
        description={`${order.number} · ${formatOrderDate(order.createdAt, locale)}`}
        title={order.projectName ?? order.snapshot.product.name}
      />

      <section
        aria-label={m.orders__job_ticket()}
        className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-[1fr_auto_1fr]"
      >
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {m.orders__production_status()}
          </span>
          {order.status === "cancelled" ? (
            <strong>{m.orders__status_cancelled()}</strong>
          ) : (
            <ol className="grid grid-cols-4 gap-2">
              {productionSteps.map((step, index) => {
                const currentIndex = productionSteps.indexOf(order.status);
                return (
                  <li className="flex min-w-0 flex-col gap-2" key={step}>
                    <span
                      aria-hidden
                      className={
                        index <= currentIndex
                          ? "h-1 rounded-full bg-foreground"
                          : "h-1 rounded-full bg-muted"
                      }
                    />
                    <span className="truncate text-xs text-muted-foreground">
                      {orderStatusLabel(step)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <Separator className="hidden h-full sm:block" orientation="vertical" />
        <div className="flex items-end justify-between gap-6 border-t p-4 sm:border-t-0 sm:p-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {m.payments__balance()}
            </span>
            <strong className="text-2xl tabular-nums">
              {format(ledger.summary.balance.amountMinor)}
            </strong>
          </div>
          <Badge variant={ledger.summary.state === "paid" ? "secondary" : "outline"}>
            {ledger.summary.state === "paid"
              ? m.payments__paid()
              : ledger.summary.state === "partially_paid"
                ? m.payments__partially_paid()
                : m.payments__unpaid()}
          </Badge>
        </div>
      </section>

      {order.cancellationStatus === "pending" ? (
        <Alert>
          <CircleAlert />
          <AlertTitle>{m.orders__cancellation_pending()}</AlertTitle>
          <AlertDescription>{m.orders__cancellation_pending_description()}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{order.snapshot.product.name}</h2>
              </CardTitle>
              <CardDescription>{m.orders__immutable_configuration()}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                {order.snapshot.selections.map((selection) => (
                  <div className="flex flex-col gap-1" key={selection.groupKey}>
                    <dt className="text-xs text-muted-foreground">{selection.groupLabel}</dt>
                    <dd className="text-sm font-medium">
                      {selection.kind === "option"
                        ? selection.optionValueLabel
                        : selection.selected}
                    </dd>
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">{m.catalog__quantity()}</dt>
                  <dd className="text-sm font-medium">{order.snapshot.quantity}</dd>
                </div>
              </dl>
              <Separator />
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium">{m.catalog__order_total()}</span>
                <span className="text-2xl font-semibold tabular-nums">
                  {format(order.snapshot.orderTotal.amountMinor)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{m.payments__history()}</h2>
              </CardTitle>
              <CardDescription>{m.payments__history_description()}</CardDescription>
            </CardHeader>
            <CardContent>
              {ledger.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{m.payments__empty()}</p>
              ) : (
                <ol className="flex flex-col divide-y">
                  {ledger.payments.map((payment) => (
                    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0" key={payment.id}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-medium">
                            {payment.reversalOfId ? m.payments__reversal() : m.payments__receipt()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {payment.actorName} · {formatOrderDateTime(payment.createdAt, locale)}
                          </span>
                          {payment.note ? (
                            <span className="text-sm text-muted-foreground">{payment.note}</span>
                          ) : null}
                        </div>
                        <strong className="shrink-0 tabular-nums">
                          {format(payment.amount.amountMinor)}
                        </strong>
                      </div>
                      {staff && payment.amount.amountMinor > 0 ? (
                        <details>
                          <summary className="w-fit cursor-pointer rounded-lg text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                            {m.payments__reverse_receipt()}
                          </summary>
                          <form
                            className="mt-4 flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-end"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const form = event.currentTarget;
                              const data = new FormData(form);
                              const parsed = reversePaymentSchema.safeParse(
                                Object.fromEntries(data)
                              );
                              if (!parsed.success) {
                                toast.error(m.payments__invalid_amount());
                                return;
                              }
                              const amountMinor = parseMajorAmount(
                                parsed.data.amount,
                                currency,
                                locale,
                                { minimumMinor: 1 }
                              );
                              if (!amountMinor) {
                                toast.error(m.payments__invalid_amount());
                                return;
                              }
                              paymentActions.reverse.mutate(
                                {
                                  amountMinor,
                                  mutationId: crypto.randomUUID(),
                                  note: parsed.data.note,
                                  receiptId: payment.id
                                },
                                { onSuccess: () => form.reset() }
                              );
                            }}
                          >
                            <Field>
                              <FieldLabel htmlFor={`reversal-amount-${payment.id}`}>
                                {m.payments__amount({ currency })}
                              </FieldLabel>
                              <Input
                                id={`reversal-amount-${payment.id}`}
                                inputMode="decimal"
                                name="amount"
                                placeholder={format(payment.amount.amountMinor)}
                                required
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor={`reversal-note-${payment.id}`}>
                                {m.payments__note()}
                              </FieldLabel>
                              <Input
                                id={`reversal-note-${payment.id}`}
                                maxLength={500}
                                name="note"
                              />
                            </Field>
                            <Button
                              disabled={!isHydrated || paymentActions.reverse.isPending}
                              type="submit"
                              variant="outline"
                            >
                              {paymentActions.reverse.isPending ? (
                                <Spinner />
                              ) : (
                                <RotateCcw data-icon="inline-start" />
                              )}
                              {m.payments__record_reversal()}
                            </Button>
                          </form>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-8">
          {staff ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>{m.orders__operations()}</h2>
                </CardTitle>
                <CardDescription>{m.orders__operations_description()}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:gap-6">
                {next && order.cancellationStatus !== "pending" ? (
                  <Button
                    disabled={busy}
                    onClick={() => actions.transition.mutate({ status: next })}
                  >
                    {actions.transition.isPending ? (
                      <Spinner />
                    ) : (
                      <ArrowRight data-icon="inline-end" />
                    )}
                    {m.orders__move_to({ status: orderStatusLabel(next) })}
                  </Button>
                ) : null}
                {order.status !== "completed" &&
                order.status !== "cancelled" &&
                order.cancellationStatus !== "pending" ? (
                  <Button
                    disabled={busy}
                    onClick={() => actions.transition.mutate({ status: "cancelled" })}
                    variant="outline"
                  >
                    {m.orders__cancel_order()}
                  </Button>
                ) : null}
                {order.cancellationStatus === "pending" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      disabled={busy}
                      onClick={() => actions.decideCancellation.mutate({ decision: "approved" })}
                      variant="outline"
                    >
                      {m.orders__approve_cancellation()}
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => actions.decideCancellation.mutate({ decision: "rejected" })}
                      variant="outline"
                    >
                      {m.orders__reject_cancellation()}
                    </Button>
                  </div>
                ) : null}
                <Separator />
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    actions.correctProjectName.mutate({
                      projectName: projectNameInput ?? order.projectName
                    });
                  }}
                >
                  <Field>
                    <FieldLabel htmlFor="project-name">{m.orders__project_name()}</FieldLabel>
                    <Input
                      id="project-name"
                      maxLength={120}
                      name="projectName"
                      onChange={(event) => setProjectNameInput(event.currentTarget.value)}
                      value={projectNameInput ?? order.projectName ?? ""}
                    />
                  </Field>
                  <Button disabled={busy} type="submit" variant="outline">
                    {m.orders__save_project_name()}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>{m.orders__customer_actions()}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button
                  disabled={!isHydrated || actions.duplicateToDraft.isPending}
                  onClick={() => {
                    actions.duplicateToDraft.mutate(undefined, {
                      onSuccess: (result) =>
                        navigate({
                          params: { draftId: result.draft.id, organizationSlug },
                          to: "/$organizationSlug/drafts/$draftId/configure"
                        })
                    });
                  }}
                  variant="outline"
                >
                  {actions.duplicateToDraft.isPending ? (
                    <Spinner />
                  ) : (
                    <CopyPlus data-icon="inline-start" />
                  )}
                  {m.orders__duplicate_to_draft()}
                </Button>
                {order.status === "placed" &&
                (order.cancellationStatus === "none" || order.cancellationStatus === "rejected") ? (
                  <Button
                    disabled={!isHydrated || actions.requestCancellation.isPending}
                    onClick={() => actions.requestCancellation.mutate(undefined)}
                    variant="outline"
                  >
                    {m.orders__request_cancellation()}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}

          {staff && order.status !== "cancelled" ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>{m.payments__record_receipt()}</h2>
                </CardTitle>
                <CardDescription>{m.payments__record_receipt_description()}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-4" onSubmit={submitPayment}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="payment-amount">
                        {m.payments__amount({ currency })}
                      </FieldLabel>
                      <Input id="payment-amount" inputMode="decimal" name="amount" required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="payment-method">{m.payments__method()}</FieldLabel>
                      <Select defaultValue="upi" name="method">
                        <SelectTrigger className="w-full" id="payment-method">
                          <SelectValue>{paymentMethodLabel}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {OfflinePaymentMethodSchema.options.map((method) => (
                              <SelectItem key={method} value={method}>
                                {paymentMethodLabel(method)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="payment-note">{m.payments__note()}</FieldLabel>
                      <Input id="payment-note" maxLength={500} name="note" />
                    </Field>
                  </FieldGroup>
                  <Button disabled={!isHydrated || paymentActions.record.isPending} type="submit">
                    {paymentActions.record.isPending ? (
                      <Spinner />
                    ) : (
                      <ReceiptText data-icon="inline-start" />
                    )}
                    {m.payments__record_receipt()}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </WorkspacePage>
  );
}
