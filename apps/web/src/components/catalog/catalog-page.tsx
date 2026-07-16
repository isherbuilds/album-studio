import { useHydrated } from "@tanstack/react-router";
import { ArrowRight, ImageOff, PackageOpen } from "lucide-react";
import { type FormEvent, useState } from "react";

import { type PublicProductSummary } from "@tsu-stack/contract/catalog";
import { m } from "@tsu-stack/i18n/messages";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { useNavigate } from "@tsu-stack/i18n/tanstack-start/hooks/use-navigate";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@tsu-stack/ui/components/dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@tsu-stack/ui/components/empty";
import { Field, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Spinner } from "@tsu-stack/ui/components/spinner";

import { Image } from "@/components/common/image";
import { useCatalogBySlugQuery, useCatalogListQuery } from "@/hooks/use-catalog";
import { useCreateDraftMutation } from "@/hooks/use-drafts";
import { formatMinorAmount } from "@/lib/money";

function CatalogProductDialog({
  organizationSlug,
  product
}: {
  organizationSlug: string;
  product: PublicProductSummary;
}) {
  const isHydrated = useHydrated();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const detailQuery = useCatalogBySlugQuery(organizationSlug, product.slug, open);
  const detail = detailQuery.data;
  const imageUrl = detail?.imageUrls[0] ?? product.thumbnailUrl;
  const createDraft = useCreateDraftMutation(organizationSlug);
  const projectNameInputId = `catalog-project-name-${product.slug}`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createDraft.isPending) return;

    const projectNameInput = event.currentTarget.elements.namedItem("projectName");
    if (!(projectNameInput instanceof HTMLInputElement)) return;

    const projectName = projectNameInput.value.trim();

    createDraft.mutate(
      { productSlug: product.slug, ...(projectName ? { projectName } : {}) },
      {
        onSuccess: ({ draft }) => {
          void navigate({
            params: { draftId: draft.id, organizationSlug },
            to: "/$organizationSlug/drafts/$draftId/configure",
            viewTransition: !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          });
        }
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open && !createDraft.isPending) createDraft.reset();
      }}
    >
      <DialogTrigger
        aria-label={product.name}
        className="group/product block h-full w-full cursor-pointer overflow-hidden rounded-lg border bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
        disabled={!isHydrated}
      >
        <span className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
          {product.thumbnailUrl ? (
            <Image
              alt=""
              className="size-full object-cover transition-transform duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/product:scale-[1.03]"
              height={480}
              src={product.thumbnailUrl}
              width={480}
            />
          ) : (
            <ImageOff aria-hidden className="size-8 text-muted-foreground" />
          )}
        </span>
        <span className="flex flex-col gap-1 p-4">
          <span className="font-medium">{product.name}</span>
          <span className="text-sm text-muted-foreground">
            {m.catalog__from_price({
              price: formatMinorAmount(product.basePriceMinor, product.currency, locale)
            })}
          </span>
        </span>
      </DialogTrigger>

      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-3xl sm:p-0"
        showCloseButton={!createDraft.isPending}
      >
        <div className="grid min-h-0 gap-4 p-4 sm:min-h-[30rem] sm:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)] sm:gap-6 sm:p-6">
          <div className="order-2 flex flex-col gap-4 sm:gap-6">
            <DialogHeader>
              <DialogTitle className="text-2xl">{detail?.name ?? product.name}</DialogTitle>
              <DialogDescription className="text-base">
                {detail?.description ??
                  m.catalog__from_price({
                    price: formatMinorAmount(product.basePriceMinor, product.currency, locale)
                  })}
              </DialogDescription>
            </DialogHeader>
            <form className="flex flex-1 flex-col gap-4 sm:gap-6" onSubmit={handleSubmit}>
              <Field>
                <FieldLabel htmlFor={projectNameInputId}>{m.drafts__project_name()}</FieldLabel>
                <Input
                  id={projectNameInputId}
                  maxLength={120}
                  name="projectName"
                  onInput={() => {
                    if (createDraft.isError) createDraft.reset();
                  }}
                  placeholder={m.drafts__project_name_placeholder()}
                />
              </Field>
              {detailQuery.isError || createDraft.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  {m.catalog__start_failed()}
                </p>
              ) : null}
              <Button
                className="mt-auto w-full"
                disabled={!detail || createDraft.isPending}
                type="submit"
              >
                {detailQuery.isPending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    {m.products__loading()}
                  </>
                ) : createDraft.isPending ? (
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
            </form>
          </div>

          <div className="order-1 aspect-4/3 overflow-hidden rounded-lg border bg-muted sm:aspect-auto">
            {imageUrl ? (
              <Image
                alt=""
                className="size-full object-cover"
                height={720}
                src={imageUrl}
                width={640}
              />
            ) : (
              <div className="grid size-full place-items-center">
                <ImageOff aria-hidden className="size-10 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CatalogPage({ organizationSlug }: { organizationSlug: string }) {
  const catalog = useCatalogListQuery(organizationSlug);
  const products = catalog.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {m.catalog__browse_title()}
        </h1>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          {m.catalog__browse_description()}
        </p>
      </header>

      {products.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <PackageOpen />
          </EmptyMedia>
          <EmptyTitle>{m.catalog__empty_catalog()}</EmptyTitle>
          <EmptyDescription>{m.catalog__empty_catalog_description()}</EmptyDescription>
        </Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <li key={product.slug}>
              <CatalogProductDialog organizationSlug={organizationSlug} product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
