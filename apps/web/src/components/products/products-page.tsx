import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, PackagePlus, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ProductContentSchema, type ProductStatus } from "@tsu-stack/contract/product";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import { Card, CardContent } from "@tsu-stack/ui/components/card";
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
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" />
        {m.products__create_title()}
      </DialogTrigger>
      <DialogContent>
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
                autoComplete="off"
                id="product-new-slug"
                name="slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
              <FieldDescription>{m.products__slug_hint()}</FieldDescription>
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

export function ProductsPage({ organizationSlug }: { organizationSlug: string }) {
  const productsQuery = useQuery(getProductsQueryOptions(organizationSlug));
  if (productsQuery.isError) throw productsQuery.error;
  const products = productsQuery.data ?? [];
  const { create } = useProductActions(organizationSlug);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesQuery =
      normalizedQuery === "" ||
      product.name.toLocaleLowerCase().includes(normalizedQuery) ||
      product.slug.toLocaleLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === "all" || product.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const counts = {
    archived: products.filter((product) => product.status === "archived").length,
    draft: products.filter((product) => product.status === "draft").length,
    published: products.filter((product) => product.status === "published").length
  };

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
        eyebrow={m.app_shell__production_workspace()}
        title={m.products__title()}
      />

      <WorkspaceStatStrip
        label={m.products__title()}
        stats={[
          { label: m.products__count({ count: products.length }), value: products.length },
          {
            label: m.products__status_published(),
            markerClassName: productStatusConfig.published.dotClass,
            value: counts.published
          },
          {
            label: m.products__status_draft(),
            markerClassName: productStatusConfig.draft.dotClass,
            value: counts.draft
          },
          {
            label: m.products__status_archived(),
            markerClassName: productStatusConfig.archived.dotClass,
            value: counts.archived
          }
        ]}
      />

      <Card className="overflow-hidden py-0">
        <WorkspaceToolbar>
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={m.products__search_placeholder()}
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={m.products__search_placeholder()}
              type="search"
              value={query}
            />
          </div>
          <Select onValueChange={(value) => setStatusFilter(value ?? "all")} value={statusFilter}>
            <SelectTrigger className="w-full sm:w-44">
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
        <CardContent className="px-0">
          {productsQuery.isPending ? (
            <div className="grid min-h-56 place-items-center">
              <Spinner />
            </div>
          ) : products.length === 0 ? (
            <Empty className="py-16">
              <EmptyMedia variant="icon">
                <PackagePlus />
              </EmptyMedia>
              <EmptyTitle>{m.products__empty_title()}</EmptyTitle>
              <EmptyDescription>{m.products__empty_description()}</EmptyDescription>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-190">
                <TableHeader>
                  <TableRow>
                    <TableHead>{m.products__name()}</TableHead>
                    <TableHead className="w-40">{m.common__status()}</TableHead>
                    <TableHead className="w-40">{m.products__pricing_title()}</TableHead>
                    <TableHead className="w-32">{m.common__revision()}</TableHead>
                    <TableHead className="w-16">
                      <span className="sr-only">{m.common__open()}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell className="h-32 text-center text-muted-foreground" colSpan={5}>
                        {m.products__no_filter_results()}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => {
                      const status = productStatusConfig[product.status];
                      return (
                        <TableRow key={product.slug}>
                          <TableCell>
                            <Link
                              className="group block w-fit rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              params={{ organizationSlug, productSlug: product.slug }}
                              to="/org/$organizationSlug/products/$productSlug"
                            >
                              <strong className="block font-medium group-hover:underline">
                                {product.name}
                              </strong>
                              <span className="text-xs text-muted-foreground">/{product.slug}</span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              <span
                                aria-hidden
                                className={cn("size-1.5 rounded-full", status.dotClass)}
                              />
                              {status.label()}
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
                          <TableCell className="text-right">
                            <Button
                              aria-label={`${product.name}: ${m.products__workbench()}`}
                              asChild
                              size="icon-sm"
                              variant="ghost"
                            >
                              <Link
                                params={{ organizationSlug, productSlug: product.slug }}
                                to="/org/$organizationSlug/products/$productSlug"
                              >
                                <ArrowUpRight />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}
