import { Building2, Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DEFAULT_ORGANIZATION_CURRENCY } from "@tsu-stack/contract/configuration";
import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
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
import { Field, FieldGroup, FieldLabel } from "@tsu-stack/ui/components/field";
import { Input } from "@tsu-stack/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@tsu-stack/ui/components/table";

import { WorkspacePage, WorkspacePageHeader, WorkspaceToolbar } from "@/components/admin/workspace";
import {
  useCreateOrganizationMutation,
  useListOrganizationsQuery
} from "@/hooks/use-platform-admin";

const EMPTY_FORM = {
  currency: DEFAULT_ORGANIZATION_CURRENCY,
  name: "",
  ownerEmail: "",
  ownerName: "",
  ownerPassword: "",
  slug: ""
};

export function PlatformOrganizationsPage() {
  const organizations = useListOrganizationsQuery();
  const createOrganization = useCreateOrganizationMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOrganizations =
    normalizedSearch === ""
      ? (organizations.data ?? [])
      : (organizations.data ?? []).filter(
          (item) =>
            item.name.toLowerCase().includes(normalizedSearch) ||
            item.slug.toLowerCase().includes(normalizedSearch)
        );

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        actions={
          <Dialog onOpenChange={setCreateOpen} open={createOpen}>
            <DialogTrigger render={<Button />}>
              <Building2 data-icon="inline-start" />
              {m.platform_admin__create_title()}
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{m.platform_admin__create_title()}</DialogTitle>
                <DialogDescription>{m.platform_admin__create_description()}</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  createOrganization.mutate(form, {
                    onSuccess: () => {
                      setForm(EMPTY_FORM);
                      setCreateOpen(false);
                      toast.success(m.platform_admin__created());
                    }
                  });
                }}
              >
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="organization-name">
                        {m.platform_admin__organization_name()}
                      </FieldLabel>
                      <Input
                        id="organization-name"
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        required
                        value={form.name}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="organization-slug">
                        {m.platform_admin__organization_slug()}
                      </FieldLabel>
                      <Input
                        id="organization-slug"
                        onChange={(event) => setForm({ ...form, slug: event.target.value })}
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        placeholder={m.platform_admin__slug_placeholder()}
                        required
                        value={form.slug}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="organization-currency">
                      {m.platform_admin__organization_currency()}
                    </FieldLabel>
                    <Input
                      id="organization-currency"
                      maxLength={3}
                      onChange={(event) =>
                        setForm({ ...form, currency: event.target.value.toUpperCase() })
                      }
                      pattern="[A-Za-z]{3}"
                      placeholder={DEFAULT_ORGANIZATION_CURRENCY}
                      required
                      value={form.currency}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="owner-name">{m.platform_admin__owner_name()}</FieldLabel>
                      <Input
                        id="owner-name"
                        onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
                        required
                        value={form.ownerName}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="owner-email">
                        {m.platform_admin__owner_email()}
                      </FieldLabel>
                      <Input
                        id="owner-email"
                        onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })}
                        required
                        type="email"
                        value={form.ownerEmail}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="owner-password">
                      {m.platform_admin__owner_password()}
                    </FieldLabel>
                    <Input
                      autoComplete="new-password"
                      id="owner-password"
                      minLength={8}
                      onChange={(event) => setForm({ ...form, ownerPassword: event.target.value })}
                      required
                      type="password"
                      value={form.ownerPassword}
                    />
                  </Field>
                  <Button disabled={createOrganization.isPending} type="submit">
                    <UserPlus data-icon="inline-start" />
                    {createOrganization.isPending
                      ? m.platform_admin__creating()
                      : m.platform_admin__create_action()}
                  </Button>
                </FieldGroup>
              </form>
            </DialogContent>
          </Dialog>
        }
        description={m.platform_admin__organizations_description()}
        eyebrow={m.platform_admin__eyebrow()}
        title={m.platform_admin__organizations_title()}
      />

      <Card className="overflow-hidden py-0" size="sm">
        <WorkspaceToolbar>
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={m.platform_admin__search_organizations()}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={m.platform_admin__search_placeholder()}
              type="search"
              value={search}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {m.platform_admin__registry_description()}
          </span>
        </WorkspaceToolbar>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table className="min-w-160">
              <TableHeader>
                <TableRow>
                  <TableHead>{m.platform_admin__organization()}</TableHead>
                  <TableHead>{m.platform_admin__workspace_url()}</TableHead>
                  <TableHead className="w-24 text-right">{m.platform_admin__access()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.isPending ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={3}>
                      <span className="inline-block h-4 w-32 animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ) : filteredOrganizations.length > 0 ? (
                  filteredOrganizations.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        /{item.slug}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            params={{ organizationSlug: item.slug }}
                            to="/admin/organizations/$organizationSlug"
                          >
                            {m.platform_admin__open()}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="h-28 text-center text-muted-foreground" colSpan={3}>
                      {search.trim()
                        ? m.platform_admin__no_search_results()
                        : m.platform_admin__empty()}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}
