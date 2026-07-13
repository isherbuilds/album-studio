import {
  type ConfigurationEvaluation,
  type ProductDefinition
} from "@tsu-stack/contract/configuration";
import { m } from "@tsu-stack/i18n/messages";
import { Separator } from "@tsu-stack/ui/components/separator";
import { cn } from "@tsu-stack/ui/lib/utils";

import { formatMinorAmount, labelForGroup, labelForOption } from "@/components/catalog/format";

/**
 * One line of the order ticket. The dotted leader between the label and the
 * figure is the bindery-receipt detail — it reads like a written-up order,
 * monotone by construction, and keeps every amount aligned to a tabular column.
 */
function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span
        className={cn("min-w-0 shrink truncate", strong ? "font-medium" : "text-muted-foreground")}
      >
        {label}
      </span>
      <span aria-hidden className="mb-[3px] flex-1 border-b border-dotted border-border" />
      <span
        className={cn("shrink-0 tabular-nums", strong ? "font-medium" : "text-muted-foreground")}
      >
        {value}
      </span>
    </div>
  );
}

export function PriceSummary({
  currency,
  evaluation,
  locale,
  product,
  quantity
}: {
  currency: string;
  evaluation: ConfigurationEvaluation;
  locale: string;
  product: ProductDefinition;
  quantity: number;
}) {
  const format = (amountMinor: number) => formatMinorAmount(amountMinor, currency, locale);

  return (
    <div className="flex flex-col gap-3">
      <Line label={m.catalog__base_price()} value={format(product.basePriceMinor)} />

      {evaluation.status === "valid"
        ? evaluation.perUnitBreakdown.map((line) => {
            if (line.kind === "base") return null;
            if (line.kind === "option") {
              return (
                <Line
                  key={`option-${line.groupKey}`}
                  label={labelForOption(product.groups, line.groupKey, line.optionValueId)}
                  value={
                    line.amountMinor === 0 ? m.catalog__included() : `+${format(line.amountMinor)}`
                  }
                />
              );
            }
            return (
              <Line
                key={`number-${line.groupKey}`}
                label={`${labelForGroup(product.groups, line.groupKey)} (${line.selected})`}
                value={
                  line.amountMinor === 0 ? m.catalog__included() : `+${format(line.amountMinor)}`
                }
              />
            );
          })
        : null}

      {evaluation.status === "valid" ? (
        <>
          <Separator className="my-1" />
          <Line
            label={m.catalog__per_unit_total()}
            strong
            value={format(evaluation.perUnitTotal.amountMinor)}
          />
          <Line label={m.catalog__quantity()} value={`× ${quantity}`} />
          <Separator className="my-1" />
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium">{m.catalog__order_total()}</span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {format(evaluation.orderTotal.amountMinor)}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
