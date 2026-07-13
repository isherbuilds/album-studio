import { ImageOff, PackageOpen } from "lucide-react";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useLocale } from "@tsu-stack/i18n/tanstack-start/components/locale-provider";
import { Card, CardContent } from "@tsu-stack/ui/components/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@tsu-stack/ui/components/empty";

import { formatMinorAmount } from "@/components/catalog/format";
import { Image } from "@/components/common/image";
import { useCatalogListQuery } from "@/hooks/use-catalog";

export function CatalogPage({ organizationSlug }: { organizationSlug: string }) {
  const { locale } = useLocale();
  const catalog = useCatalogListQuery(organizationSlug);
  const products = catalog.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col gap-2 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {m.catalog__browse_title()}
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
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
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <li key={product.slug}>
              <Link
                className="group/product block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                params={{ organizationSlug, productSlug: product.slug }}
                to="/org/$organizationSlug/catalog/$productSlug"
              >
                <Card className="h-full transition-shadow group-hover/product:ring-foreground/20">
                  <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
                    {product.thumbnailUrl ? (
                      <Image
                        alt=""
                        className="size-full object-cover transition-transform duration-300 group-hover/product:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/product:scale-100"
                        height={480}
                        src={product.thumbnailUrl}
                        width={480}
                      />
                    ) : (
                      <ImageOff aria-hidden className="size-8 text-muted-foreground" />
                    )}
                  </div>
                  <CardContent className="flex flex-col gap-1">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {m.catalog__from_price({
                        price: formatMinorAmount(product.basePriceMinor, product.currency, locale)
                      })}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
