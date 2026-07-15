import { CircleDollarSign } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { type ProductEditor, type ProductEditPricingInput } from "@tsu-stack/contract/product";
import { m } from "@tsu-stack/i18n/messages";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import { Field, FieldError, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Separator } from "@tsu-stack/ui/components/separator";

import { currencyFractionDigits, minorToMajorInput, parseMoneyMinor } from "./format";

const PricingEntriesSchema = z.record(z.string(), z.string());

type PricingInput = Omit<
  ProductEditPricingInput,
  "expectedRevision" | "organizationSlug" | "productSlug"
>;

export function ProductPricingForm({
  editor,
  isSaving,
  onSave
}: {
  editor: ProductEditor;
  isSaving: boolean;
  onSave: (input: PricingInput) => void;
}) {
  const { locale } = useLocale();
  const currency = editor.currency;
  const step = 1 / 10 ** currencyFractionDigits(currency, locale);
  const [error, setError] = useState<string | null>(null);

  const optionValues = editor.groups.flatMap((group) =>
    group.type === "number"
      ? []
      : group.values.map((value) => {
          return {
            groupLabel: group.label,
            id: value.id,
            label: value.label,
            priceAdjustmentMinor: value.priceAdjustmentMinor
          };
        })
  );
  const numericGroups = editor.groups.flatMap((group) =>
    group.type === "number"
      ? [
          {
            additionalUnitPriceMinor: group.additionalUnitPriceMinor,
            key: group.key,
            label: group.label
          }
        ]
      : []
  );
  const hasPriceable = optionValues.length > 0 || numericGroups.length > 0;

  const moneyDefault = (amountMinor: number | null) =>
    amountMinor === null ? "" : minorToMajorInput(amountMinor, currency, locale);

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <CircleDollarSign />
          <h2>{m.products__pricing_title()}</h2>
        </CardTitle>
        <CardDescription>{m.products__pricing_description({ currency })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const parsedEntries = PricingEntriesSchema.safeParse(Object.fromEntries(data));
            if (!parsedEntries.success) {
              setError(m.products__invalid());
              return;
            }
            const entries = parsedEntries.data;
            const basePriceMinor = parseMoneyMinor(entries.base ?? "", currency, locale);
            if (basePriceMinor === undefined) {
              setError(m.products__invalid());
              return;
            }
            const optionValuePrices: PricingInput["optionValuePrices"] = [];
            for (const value of optionValues) {
              const minor = parseMoneyMinor(entries[`value::${value.id}`] ?? "", currency, locale);
              if (minor === undefined) {
                setError(m.products__invalid());
                return;
              }
              optionValuePrices.push({ optionValueId: value.id, priceAdjustmentMinor: minor });
            }
            const numericGroupPrices: PricingInput["numericGroupPrices"] = [];
            for (const group of numericGroups) {
              const minor = parseMoneyMinor(
                entries[`numeric::${group.key}`] ?? "",
                currency,
                locale
              );
              if (minor === undefined) {
                setError(m.products__invalid());
                return;
              }
              numericGroupPrices.push({ additionalUnitPriceMinor: minor, groupKey: group.key });
            }
            setError(null);
            onSave({ basePriceMinor, numericGroupPrices, optionValuePrices });
          }}
        >
          <div className="flex flex-col gap-5">
            <Field className="max-w-xs">
              <FieldLabel htmlFor="pricing-base">{m.products__base_price()}</FieldLabel>
              <Input
                defaultValue={moneyDefault(editor.basePriceMinor)}
                id="pricing-base"
                inputMode="decimal"
                min="0"
                name="base"
                placeholder="0"
                required
                step={step}
                type="number"
              />
            </Field>

            {optionValues.length > 0 ? (
              <section className="flex flex-col gap-3">
                <Separator />
                <h3 className="text-sm font-medium">{m.products__option_adjustments()}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {optionValues.map((value) => (
                    <Field key={value.id}>
                      <FieldLabel htmlFor={`pricing-value-${value.id}`}>
                        <span className="text-muted-foreground">{value.groupLabel} · </span>
                        {value.label}
                      </FieldLabel>
                      <Input
                        defaultValue={moneyDefault(value.priceAdjustmentMinor)}
                        id={`pricing-value-${value.id}`}
                        inputMode="decimal"
                        min="0"
                        name={`value::${value.id}`}
                        placeholder="0"
                        required
                        step={step}
                        type="number"
                      />
                    </Field>
                  ))}
                </div>
              </section>
            ) : null}

            {numericGroups.length > 0 ? (
              <section className="flex flex-col gap-3">
                <Separator />
                <h3 className="text-sm font-medium">{m.products__numeric_pricing()}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {numericGroups.map((group) => (
                    <Field key={group.key}>
                      <FieldLabel htmlFor={`pricing-numeric-${group.key}`}>
                        <span className="text-muted-foreground">{group.label} · </span>
                        {m.products__additional_unit_price()}
                      </FieldLabel>
                      <Input
                        defaultValue={moneyDefault(group.additionalUnitPriceMinor)}
                        id={`pricing-numeric-${group.key}`}
                        inputMode="decimal"
                        min="0"
                        name={`numeric::${group.key}`}
                        placeholder="0"
                        required
                        step={step}
                        type="number"
                      />
                    </Field>
                  ))}
                </div>
              </section>
            ) : null}

            {!hasPriceable ? (
              <p className="text-sm text-muted-foreground">{m.products__no_priceable()}</p>
            ) : null}

            {error ? <FieldError>{error}</FieldError> : null}

            <Button className="self-start" disabled={isSaving} type="submit">
              {isSaving ? m.products__saving() : m.products__save_pricing()}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
