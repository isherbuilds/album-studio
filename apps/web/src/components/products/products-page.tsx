import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PackagePlus, Plus, Search } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  ProductContentSchema,
  ProductStatusSchema,
  type ProductStatus
} from "@tsu-stack/contract/product";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import { Card } from "@tsu-stack/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@tsu-stack/ui/components/dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@tsu-stack/ui/components/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@tsu-stack/ui/components/select";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@tsu-stack/ui/components/table";
import { Textarea } from "@tsu-stack/ui/components/textarea";
import { cn } from "@tsu-stack/ui/lib/utils";

import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceStatStrip,
  WorkspaceToolbar
} from "@/components/admin/workspace";
import { DataPagination } from "@/components/common/data-pagination";
import { SearchResultsStatus } from "@/components/common/search-results-status";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getProductsQueryOptions, useProductActions } from "@/hooks/use-products";

import { productStatusConfig } from "./format";

const CreateProductContentFormSchema = z.object({
  description: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(ProductContentSchema.shape.description),
  name: ProductContentSchema.shape.name,
  slug: ProductContentSchema.shape.slug
});

function productStatusFilterLabel(value: "all" | ProductStatus) {
  return value === "all" ? m.products__all_statuses() : productStatusConfig[value].label();
}

function CreateProductDialog({
  isCreating,
  onCreate
}: {
  isCreating: boolean;
  onCreate: (
    input: {
      description: string | null;
      imageUrls: string[];
      name: string;
      slug: string;
    },
    onSuccess: () => void
  ) => void;
}) {
  const slugDescriptionId = useId();
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" />
        {m.products__create_title()}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] min-h-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{m.products__create_title()}</DialogTitle>
          <DialogDescription>{m.products__create_description()}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const parsed = CreateProductContentFormSchema.safeParse(Object.fromEntries(data));
            if (!parsed.success) {
              toast.error(m.products__invalid());
              return;
            }
            onCreate(
              {
                ...parsed.data,
                imageUrls: []
              },
              () => {
                form.reset();
                setOpen(false);
              }
            );
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="product-new-name">{m.products__name()}</FieldLabel>
              <Input autoComplete="off" id="product-new-name" name="name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="product-new-slug">{m.products__slug()}</FieldLabel>
              <Input
                aria-describedby={slugDescriptionId}
                autoComplete="off"
                id="product-new-slug"
                name="slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
              <FieldDescription id={slugDescriptionId}>{m.products__slug_hint()}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="product-new-description">
                {m.products__short_description()}{" "}
                <span className="font-normal text-muted-foreground">
                  ({m.products__optional()})
                </span>
              </FieldLabel>
              <Textarea id="product-new-description" name="description" rows={3} />
            </Field>
            <Button disabled={isCreating} type="submit">
              {isCreating ? m.products__creating() : m.products__create_action()}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ProductsTablePanelProps = {
  onPageChange: (page: number) => void;
  onStatusChange: (status: ProductStatus | undefined) => void;
  organizationSlug: string;
  page: number;
  status: ProductStatus | undefined;
};

function ProductsTablePanel({
  onPageChange,
  onStatusChange,
  organizationSlug,
  page,
  status
}: ProductsTablePanelProps) {
  const [query, setQuery] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query.trim());
  const activePage = debouncedQuery ? searchPage : page;
  const productsQuery = useQuery({
    ...getProductsQueryOptions(organizationSlug, {
      page: activePage,
      query: debouncedQuery,
      status
    }),
    placeholderData: keepPreviousData
  });
  if (productsQuery.isError) throw productsQuery.error;
  const result = productsQuery.data;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <WorkspaceToolbar>
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={m.products__search_placeholder()}
            className="pl-9"
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchPage(1);
            }}
            placeholder={m.products__search_placeholder()}
            type="search"
            value={query}
          />
        </div>
        <Select
          onValueChange={(value) =>
            onStatusChange(
              value === "all" || value === null ? undefined : ProductStatusSchema.parse(value)
            )
          }
          value={status ?? "all"}
        >
          <SelectTrigger
            aria-label={`${m.products__status_filter()}: ${productStatusFilterLabel(status ?? "all")}`}
            className="w-full sm:w-44"
          >
            <SelectValue>{productStatusFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{m.products__all_statuses()}</SelectItem>
              <SelectItem value="published">{m.products__status_published()}</SelectItem>
              <SelectItem value="draft">{m.products__status_draft()}</SelectItem>
              <SelectItem value="archived">{m.products__status_archived()}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </WorkspaceToolbar>
      <SearchResultsStatus
        isFetching={productsQuery.isFetching}
        loadingLabel={m.products__loading()}
        total={result?.total}
      />
      <div>
        {productsQuery.isPending || result === undefined ? (
          <output aria-label={m.products__loading()} className="grid min-h-56 place-items-center">
            <Spinner aria-label={m.products__loading()} />
          </output>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-190">
              <TableHeader>
                <TableRow>
                  <TableHead>{m.products__name()}</TableHead>
                  <TableHead className="w-40">{m.common__status()}</TableHead>
                  <TableHead className="w-40">{m.products__pricing_title()}</TableHead>
                  <TableHead className="w-32">{m.common__revision()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-32 text-center text-muted-foreground" colSpan={4}>
                      {m.products__no_filter_results()}
                    </TableCell>
                  </TableRow>
                ) : (
                  result.items.map((product) => {
                    const productStatus = productStatusConfig[product.status];
                    return (
                      <TableRow key={product.slug}>
                        <TableCell className="max-w-80">
                          <Link
                            className="group block max-w-80 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            params={{ organizationSlug, productSlug: product.slug }}
                            to="/$organizationSlug/admin/products/$productSlug"
                          >
                            <strong
                              className="block truncate font-medium group-hover:underline"
                              title={product.name}
                            >
                              {product.name}
                            </strong>
                            <span
                              className="block truncate text-xs text-muted-foreground"
                              title={`/${product.slug}`}
                            >
                              /{product.slug}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <span
                              aria-hidden
                              className={cn("size-1.5 rounded-full", productStatus.dotClass)}
                            />
                            {productStatus.label()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {product.basePriceMinor === null
                              ? m.products__no_price()
                              : m.products__priced()}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground tabular-nums">
                          {product.revision}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {result ? (
        <DataPagination
          isFetching={productsQuery.isFetching}
          onPageChange={(nextPage) => {
            if (debouncedQuery) setSearchPage(nextPage);
            else onPageChange(nextPage);
          }}
          page={result.page}
          pageCount={result.pageCount}
        />
      ) : null}
    </div>
  );
}

export function ProductsPage({
  onPageChange,
  onStatusChange,
  organizationSlug,
  page,
  status
}: ProductsTablePanelProps) {
  const productsQuery = useQuery(getProductsQueryOptions(organizationSlug, { page, status }));
  const result = productsQuery.data;
  const { create } = useProductActions(organizationSlug);
  if (productsQuery.isError) throw productsQuery.error;
  const totalProducts = result
    ? result.counts.archived + result.counts.draft + result.counts.published
    : 0;

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        actions={
          <CreateProductDialog
            isCreating={create.isPending}
            onCreate={(input, onSuccess) => create.mutate(input, { onSuccess })}
          />
        }
        description={m.products__description()}
        title={m.products__title()}
      />

      <WorkspaceStatStrip
        label={m.products__title()}
        stats={[
          {
            id: "total",
            label: m.products__count({ count: totalProducts }),
            value: totalProducts
          },
          {
            id: "published",
            label: m.products__status_published(),
            markerClassName: productStatusConfig.published.dotClass,
            value: result?.counts.published ?? 0
          },
          {
            id: "draft",
            label: m.products__status_draft(),
            markerClassName: productStatusConfig.draft.dotClass,
            value: result?.counts.draft ?? 0
          },
          {
            id: "archived",
            label: m.products__status_archived(),
            markerClassName: productStatusConfig.archived.dotClass,
            value: result?.counts.archived ?? 0
          }
        ]}
      />

      {productsQuery.isPending || result === undefined ? (
        <Card>
          <output aria-label={m.products__loading()} className="grid min-h-56 place-items-center">
            <Spinner aria-label={m.products__loading()} />
          </output>
        </Card>
      ) : totalProducts === 0 ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Empty className="py-16">
            <EmptyMedia variant="icon">
              <PackagePlus />
            </EmptyMedia>
            <EmptyTitle>{m.products__empty_title()}</EmptyTitle>
            <EmptyDescription>{m.products__empty_description()}</EmptyDescription>
          </Empty>
        </div>
      ) : (
        <ProductsTablePanel
          onPageChange={onPageChange}
          onStatusChange={onStatusChange}
          organizationSlug={organizationSlug}
          page={page}
          status={status}
        />
      )}
    </WorkspacePage>
  );
}
