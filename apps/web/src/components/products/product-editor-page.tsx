import { useQuery } from "@tanstack/react-query";
import {
  ArchiveRestore,
  ArrowLeft,
  CheckCircle2,
  FileText,
  ImagePlus,
  Trash2,
  TriangleAlert,
  UploadCloud,
  X
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { type ProductEditor } from "@tsu-stack/contract/product";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { useNavigate } from "@tsu-stack/i18n/tanstack-start/hooks/use-navigate";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Separator } from "@tsu-stack/ui/components/separator";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tsu-stack/ui/components/tabs";
import { Textarea } from "@tsu-stack/ui/components/textarea";

import { WorkspacePage, WorkspacePageHeader } from "@/components/admin/workspace";
import { getProductQueryOptions, useProductActions } from "@/hooks/use-products";

import { formText, formatIssuePath, productStatusConfig } from "./format";
import { ProductConfigurationEditor } from "./product-configuration-editor";
import { ProductPreview } from "./product-preview";
import { ProductPricingForm } from "./product-pricing-form";

type ContentDraft = {
  description: string | null;
  imageUrls: string[];
  name: string;
  slug: string;
};

function ContentForm({
  editor,
  isSaving,
  onSave
}: {
  editor: ProductEditor;
  isSaving: boolean;
  onSave: (content: ContentDraft) => void;
}) {
  const [imageUrls, setImageUrls] = useState<string[]>(editor.imageUrls);
  const [newImage, setNewImage] = useState("");
  const [dirty, setDirty] = useState(false);

  const addImage = () => {
    const trimmed = newImage.trim();
    if (trimmed === "") return;
    setImageUrls((prev) => [...prev, trimmed]);
    setNewImage("");
    setDirty(true);
  };

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <FileText />
          <h2>{m.products__content_title()}</h2>
        </CardTitle>
        <CardDescription>{m.products__content_description()}</CardDescription>
        {dirty ? (
          <CardAction>
            <Badge variant="outline">{m.products__unsaved()}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <form
          onChange={() => setDirty(true)}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const description = formText(data, "description").trim();
            onSave({
              description: description === "" ? null : description,
              imageUrls,
              name: formText(data, "name"),
              slug: formText(data, "slug")
            });
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="content-name">{m.products__name()}</FieldLabel>
                <Input defaultValue={editor.name} id="content-name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="content-slug">{m.products__slug()}</FieldLabel>
                <Input
                  defaultValue={editor.slug}
                  id="content-slug"
                  name="slug"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
                <FieldDescription>{m.products__slug_hint()}</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="content-description">
                {m.products__short_description()}
              </FieldLabel>
              <Textarea
                defaultValue={editor.description ?? ""}
                id="content-description"
                name="description"
                rows={3}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="content-image">{m.products__images()}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="content-image"
                  onChange={(event) => setNewImage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addImage();
                    }
                  }}
                  placeholder="https://"
                  value={newImage}
                />
                <Button onClick={addImage} type="button" variant="outline">
                  <ImagePlus data-icon="inline-start" />
                  {m.products__add_image()}
                </Button>
              </div>
              {imageUrls.length === 0 ? (
                <FieldDescription>{m.products__no_images()}</FieldDescription>
              ) : (
                <ul className="mt-1 flex flex-col gap-1.5">
                  {imageUrls.map((url, index) => (
                    <li
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 py-1 pr-1 pl-3"
                      key={`${url}-${index}`}
                    >
                      <span className="min-w-0 truncate text-xs">{url}</span>
                      <Button
                        aria-label={m.products__remove_image()}
                        onClick={() => {
                          setImageUrls((prev) => prev.filter((_, i) => i !== index));
                          setDirty(true);
                        }}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            <Button className="self-start" disabled={isSaving || !dirty} type="submit">
              {isSaving ? m.products__saving() : m.products__save_content()}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function ConfirmButton({
  children,
  confirmLabel,
  icon,
  isPending,
  message,
  onConfirm,
  pendingLabel,
  variant
}: {
  children: string;
  confirmLabel: string;
  icon: ReactNode;
  isPending: boolean;
  message: string;
  onConfirm: () => void;
  pendingLabel: string;
  variant: "outline" | "destructive";
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
        <p className="text-xs text-muted-foreground">{message}</p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={isPending}
            onClick={() => onConfirm()}
            size="sm"
            type="button"
            variant={variant}
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => setConfirming(false)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {m.products__keep_editing()}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <Button
      className="justify-start"
      onClick={() => setConfirming(true)}
      type="button"
      variant={variant}
    >
      {icon}
      {children}
    </Button>
  );
}

export function ProductEditorPage({
  canDelete,
  canEditPricing,
  organizationSlug,
  productSlug
}: {
  canDelete: boolean;
  canEditPricing: boolean;
  organizationSlug: string;
  productSlug: string;
}) {
  const navigate = useNavigate();
  const productQuery = useQuery(getProductQueryOptions(organizationSlug, productSlug));
  const { archive, editConfiguration, editContent, editPricing, preview, publish, remove } =
    useProductActions(organizationSlug);

  if (productQuery.isPending) {
    return (
      <output className="grid min-h-64 place-items-center">
        <Spinner />
        <span className="sr-only">{m.products__loading()}</span>
      </output>
    );
  }
  if (productQuery.isError || !productQuery.data) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-8">
        <p className="text-sm text-destructive" role="alert">
          {m.products__load_failed()}
        </p>
        <Button asChild variant="outline">
          <Link params={{ organizationSlug }} to="/org/$organizationSlug/products">
            <ArrowLeft data-icon="inline-start" />
            {m.products__back_to_products()}
          </Link>
        </Button>
      </div>
    );
  }

  const editor = productQuery.data;
  const status = productStatusConfig[editor.status];
  const issues = editor.validationIssues;
  const ready = issues.length === 0;

  return (
    <WorkspacePage>
      <Button asChild className="w-fit px-0" variant="link">
        <Link params={{ organizationSlug }} to="/org/$organizationSlug/products">
          <ArrowLeft data-icon="inline-start" />
          {m.products__back_to_products()}
        </Link>
      </Button>

      <WorkspacePageHeader
        actions={
          <Badge variant="outline">
            <span aria-hidden className={`size-1.5 rounded-full ${status.dotClass}`} />
            {status.label()}
          </Badge>
        }
        description={`/${editor.slug} · ${m.products__revision({ revision: editor.revision })}`}
        eyebrow={m.products__workbench()}
        title={editor.name}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Tabs className="min-w-0" defaultValue="details">
          <TabsList className="max-w-full justify-start overflow-x-auto" variant="line">
            <TabsTrigger value="details">
              <span className="font-mono text-[10px] text-muted-foreground">01</span>
              {m.products__details_tab()}
            </TabsTrigger>
            <TabsTrigger value="options">
              <span className="font-mono text-[10px] text-muted-foreground">02</span>
              {m.products__options_tab()}
            </TabsTrigger>
            {canEditPricing ? (
              <TabsTrigger value="pricing">
                <span className="font-mono text-[10px] text-muted-foreground">03</span>
                {m.products__pricing_title()}
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="preview">
              <span className="font-mono text-[10px] text-muted-foreground">
                {canEditPricing ? "04" : "03"}
              </span>
              {m.products__preview_title()}
            </TabsTrigger>
          </TabsList>

          <TabsContent className="pt-4" value="details">
            <ContentForm
              editor={editor}
              isSaving={editContent.isPending}
              onSave={(content) =>
                editContent.mutate(
                  {
                    description: content.description,
                    expectedRevision: editor.revision,
                    imageUrls: content.imageUrls,
                    name: content.name,
                    productSlug,
                    slug: content.slug
                  },
                  {
                    onSuccess: (updated) => {
                      if (updated.slug !== productSlug) {
                        void navigate({
                          params: { organizationSlug, productSlug: updated.slug },
                          to: "/org/$organizationSlug/products/$productSlug"
                        });
                      }
                    }
                  }
                )
              }
            />
          </TabsContent>

          <TabsContent className="pt-4" value="options">
            <ProductConfigurationEditor
              groups={editor.groups}
              isSaving={editConfiguration.isPending}
              onSave={(groups) =>
                editConfiguration.mutate({ expectedRevision: editor.revision, groups, productSlug })
              }
              organizationSlug={organizationSlug}
            />
          </TabsContent>

          {canEditPricing ? (
            <TabsContent className="pt-4" value="pricing">
              <ProductPricingForm
                editor={editor}
                isSaving={editPricing.isPending}
                onSave={(input) =>
                  editPricing.mutate({ ...input, expectedRevision: editor.revision, productSlug })
                }
              />
            </TabsContent>
          ) : null}

          <TabsContent className="pt-4" value="preview">
            <ProductPreview
              editor={editor}
              isError={preview.isError}
              isPreviewing={preview.isPending}
              onPreview={(input) => preview.mutate({ ...input, productSlug })}
              result={preview.data}
            />
          </TabsContent>
        </Tabs>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>
                <h2>{m.products__validation_title()}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {ready ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="size-4" />
                  {m.products__validation_ready()}
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm text-destructive">
                    <TriangleAlert className="size-4" />
                    {m.products__validation_issue_count({ count: issues.length })}
                  </p>
                  <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                    {issues.map((issue, index) => (
                      <li key={`${formatIssuePath(issue.path)}-${index}`}>
                        <span className="font-medium text-foreground">
                          {formatIssuePath(issue.path)}
                        </span>{" "}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <Separator />

              <div className="flex flex-col gap-2">
                {editor.status !== "published" ? (
                  <Button
                    disabled={publish.isPending || !ready}
                    onClick={() =>
                      publish.mutate({ expectedRevision: editor.revision, productSlug })
                    }
                    type="button"
                  >
                    <UploadCloud data-icon="inline-start" />
                    {publish.isPending ? m.products__publishing() : m.products__publish()}
                  </Button>
                ) : null}

                {editor.status !== "archived" ? (
                  <ConfirmButton
                    confirmLabel={m.products__archive()}
                    icon={<ArchiveRestore data-icon="inline-start" />}
                    isPending={archive.isPending}
                    message={m.products__confirm_archive()}
                    onConfirm={() =>
                      archive.mutate({ expectedRevision: editor.revision, productSlug })
                    }
                    pendingLabel={m.products__archiving()}
                    variant="outline"
                  >
                    {m.products__archive()}
                  </ConfirmButton>
                ) : (
                  <p className="text-xs text-muted-foreground">{m.products__unarchive_hint()}</p>
                )}

                {canDelete ? (
                  <ConfirmButton
                    confirmLabel={m.products__remove()}
                    icon={<Trash2 data-icon="inline-start" />}
                    isPending={remove.isPending}
                    message={m.products__confirm_remove()}
                    onConfirm={() =>
                      remove.mutate(
                        { expectedRevision: editor.revision, productSlug },
                        {
                          onSuccess: () => {
                            void navigate({
                              params: { organizationSlug },
                              to: "/org/$organizationSlug/products"
                            });
                          }
                        }
                      )
                    }
                    pendingLabel={m.products__removing()}
                    variant="destructive"
                  >
                    {m.products__remove()}
                  </ConfirmButton>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </WorkspacePage>
  );
}
