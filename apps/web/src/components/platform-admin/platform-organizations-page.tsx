import { Building2, Search, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";

import { DEFAULT_ORGANIZATION_CURRENCY } from "@tsu-stack/contract/configuration";
import { PlatformCreateOrganizationInputSchema } from "@tsu-stack/contract/organization";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@tsu-stack/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import { Spinner } from "@tsu-stack/ui/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@tsu-stack/ui/components/table";

import { WorkspacePage, WorkspacePageHeader, WorkspaceToolbar } from "@/components/admin/workspace";
import { DataPagination } from "@/components/common/data-pagination";
import { TextField } from "@/components/form/text-field";
import { useZodForm } from "@/components/form/use-zod-form";
import {
  useCreateOrganizationMutation,
  useListOrganizationsQuery
} from "@/hooks/use-platform-admin";

const ORGANIZATIONS_PER_PAGE = 20;

function OrganizationsTable() {
  const organizations = useListOrganizationsQuery();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  if (organizations.isError) throw organizations.error;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOrganizations =
    normalizedSearch === ""
      ? (organizations.data ?? [])
      : (organizations.data ?? []).filter(
          (item) =>
            item.name.toLowerCase().includes(normalizedSearch) ||
            item.slug.toLowerCase().includes(normalizedSearch)
        );
  const pageCount = Math.ceil(filteredOrganizations.length / ORGANIZATIONS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(pageCount, 1));
  const visibleOrganizations = filteredOrganizations.slice(
    (currentPage - 1) * ORGANIZATIONS_PER_PAGE,
    currentPage * ORGANIZATIONS_PER_PAGE
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <WorkspaceToolbar>
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={m.platform_admin__search_organizations()}
            className="pl-9"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={m.platform_admin__search_placeholder()}
            type="search"
            value={search}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {m.platform_admin__registry_description()}
        </span>
      </WorkspaceToolbar>
      <div className="overflow-x-auto">
        <Table className="min-w-160">
          <TableHeader>
            <TableRow>
              <TableHead>{m.platform_admin__organization()}</TableHead>
              <TableHead>{m.platform_admin__workspace_url()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.isPending ? (
              <TableRow>
                <TableCell className="h-32" colSpan={2}>
                  <output
                    aria-label={m.platform_admin__organizations_title()}
                    className="grid place-items-center"
                  >
                    <Spinner aria-label={m.platform_admin__organizations()} />
                  </output>
                </TableCell>
              </TableRow>
            ) : visibleOrganizations.length > 0 ? (
              visibleOrganizations.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-80">
                    <Link
                      className="block truncate rounded-md font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      params={{ organizationSlug: item.slug }}
                      to="/admin/organizations/$organizationSlug"
                    >
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-72 font-mono text-xs text-muted-foreground">
                    <span className="block truncate" title={`/${item.slug}`}>
                      /{item.slug}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={2}>
                  {search.trim()
                    ? m.platform_admin__no_search_results()
                    : m.platform_admin__empty()}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataPagination
        isFetching={organizations.isFetching}
        onPageChange={setPage}
        page={currentPage}
        pageCount={pageCount}
      />
    </div>
  );
}

export function PlatformOrganizationsPage() {
  const createOrganization = useCreateOrganizationMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const currencyErrorId = useId();
  const form = useZodForm(PlatformCreateOrganizationInputSchema, {
    defaultValues: {
      currency: DEFAULT_ORGANIZATION_CURRENCY,
      name: "",
      ownerEmail: "",
      ownerName: "",
      ownerPassword: "",
      slug: ""
    }
  });
  const onSubmit = form.handleSubmit((value) => {
    createOrganization.mutate(value, {
      onSuccess: () => {
        form.reset();
        setCreateOpen(false);
        toast.success(m.platform_admin__created());
      }
    });
  });

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        actions={
          <Dialog onOpenChange={setCreateOpen} open={createOpen}>
            <DialogTrigger render={<Button />}>
              <Building2 data-icon="inline-start" />
              {m.platform_admin__create_title()}
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-2rem)] min-h-0 overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{m.platform_admin__create_title()}</DialogTitle>
                <DialogDescription>{m.platform_admin__create_description()}</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit}>
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      error={form.formState.errors.name}
                      label={m.platform_admin__organization_name()}
                      maxLength={120}
                      minLength={2}
                      registration={form.register("name")}
                      required
                    />
                    <TextField
                      error={form.formState.errors.slug}
                      label={m.platform_admin__organization_slug()}
                      maxLength={80}
                      minLength={2}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      placeholder={m.platform_admin__slug_placeholder()}
                      registration={form.register("slug")}
                      required
                    />
                  </div>
                  <Controller
                    control={form.control}
                    name="currency"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid || undefined}>
                        <FieldLabel htmlFor={field.name}>
                          {m.platform_admin__organization_currency()}
                        </FieldLabel>
                        <Input
                          {...field}
                          aria-describedby={fieldState.invalid ? currencyErrorId : undefined}
                          aria-errormessage={fieldState.invalid ? currencyErrorId : undefined}
                          aria-invalid={fieldState.invalid || undefined}
                          id={field.name}
                          maxLength={3}
                          onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                          pattern="[A-Za-z]{3}"
                          placeholder={DEFAULT_ORGANIZATION_CURRENCY}
                          required
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} id={currencyErrorId} />
                        )}
                      </Field>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      error={form.formState.errors.ownerName}
                      label={m.platform_admin__owner_name()}
                      maxLength={120}
                      minLength={2}
                      registration={form.register("ownerName")}
                      required
                    />
                    <TextField
                      error={form.formState.errors.ownerEmail}
                      label={m.platform_admin__owner_email()}
                      registration={form.register("ownerEmail")}
                      required
                      type="email"
                    />
                  </div>
                  <TextField
                    autoComplete="new-password"
                    error={form.formState.errors.ownerPassword}
                    label={m.platform_admin__owner_password()}
                    maxLength={128}
                    minLength={8}
                    registration={form.register("ownerPassword")}
                    required
                    type="password"
                  />
                  <Field>
                    <Button disabled={createOrganization.isPending} type="submit">
                      {createOrganization.isPending ? (
                        <>
                          <UserPlus data-icon="inline-start" />
                          {m.platform_admin__creating()}
                        </>
                      ) : (
                        <>
                          <UserPlus data-icon="inline-start" />
                          {m.platform_admin__create_action()}
                        </>
                      )}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </DialogContent>
          </Dialog>
        }
        description={m.platform_admin__organizations_description()}
        title={m.platform_admin__organizations_title()}
      />

      <OrganizationsTable />
    </WorkspacePage>
  );
}
