import { useHydrated } from "@tanstack/react-router";
import { ArrowRight, ImageOff } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { useNavigate } from "@tsu-stack/i18n/tanstack-start/hooks/use-navigate";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import { Spinner } from "@tsu-stack/ui/components/spinner";

import { formatMinorAmount } from "@/components/catalog/format";
import { Image } from "@/components/common/image";
import { useCatalogBySlugQuery } from "@/hooks/use-catalog";
import { useCreateDraftMutation } from "@/hooks/use-drafts";

export function ProductStartPage({
  organizationSlug,
  productSlug
}: {
  organizationSlug: string;
  productSlug: string;
}) {
  const { locale } = useLocale();
  const isHydrated = useHydrated();
  const navigate = useNavigate();
  const catalog = useCatalogBySlugQuery(organizationSlug, productSlug);
  const createDraft = useCreateDraftMutation(organizationSlug);
  const product = catalog.data;

  if (!product) return null;

  return (
    <div className="mx-auto grid max-w-7xl items-start gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-2 border-b pb-6">
          <p className="text-sm text-muted-foreground">{m.catalog__browse_title()}</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{product.name}</h1>
          {product.description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{product.description}</p>
          ) : null}
        </header>
        <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl bg-muted">
          {product.imageUrls[0] ? (
            <Image
              alt={product.name}
              className="size-full object-cover"
              height={800}
              src={product.imageUrls[0]}
              width={1280}
            />
          ) : (
            <ImageOff aria-hidden className="size-10 text-muted-foreground/50" />
          )}
        </div>
      </div>

      <Card className="top-22 lg:sticky">
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
          <CardDescription>
            {m.catalog__from_price({
              price: formatMinorAmount(product.definition.basePriceMinor, product.currency, locale)
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{m.catalog__browse_description()}</p>
          {createDraft.isError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {m.catalog__start_failed()}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            disabled={!isHydrated || createDraft.isPending}
            onClick={() =>
              createDraft.mutate(
                { productSlug },
                {
                  onSuccess: ({ draft }) => {
                    void navigate({
                      params: { draftId: draft.id, organizationSlug },
                      to: "/org/$organizationSlug/drafts/$draftId/configure"
                    });
                  }
                }
              )
            }
            type="button"
          >
            {createDraft.isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                {m.catalog__starting_configuration()}
              </>
            ) : (
              <>
                {m.catalog__start_configuration()}
                <ArrowRight data-icon="inline-end" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
