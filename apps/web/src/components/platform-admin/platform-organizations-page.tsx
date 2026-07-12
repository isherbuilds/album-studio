import { Building2, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { m } from "@tsu-stack/i18n/messages";
import { Link } from "@tsu-stack/i18n/tanstack-start/components/link";
import { Badge } from "@tsu-stack/ui/components/badge";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@tsu-stack/ui/components/card";
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

import {
  useCreateOrganizationMutation,
  useListOrganizationsQuery
} from "@/hooks/use-platform-admin";

const EMPTY_FORM = {
  name: "",
  ownerEmail: "",
  ownerName: "",
  ownerPassword: "",
  slug: ""
};

export function PlatformOrganizationsPage() {
  const organizations = useListOrganizationsQuery();
  const createOrganization = useCreateOrganizationMutation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const filteredOrganizations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return organizations.data ?? [];
    return (organizations.data ?? []).filter(
      (item) => item.name.toLowerCase().includes(query) || item.slug.toLowerCase().includes(query)
    );
  }, [organizations.data, search]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{m.platform_admin__eyebrow()}</Badge>
          <span className="text-xs text-muted-foreground">
            {m.platform_admin__private_deployment()}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {m.platform_admin__organizations_title()}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {m.platform_admin__organizations_description()}
        </p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="min-w-0" size="sm">
          <CardHeader className="border-b">
            <CardTitle>{m.platform_admin__organizations()}</CardTitle>
            <CardDescription>{m.platform_admin__registry_description()}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={m.platform_admin__search_organizations()}
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={m.platform_admin__search_placeholder()}
                value={search}
              />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
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
                      <TableCell className="h-24 text-center text-muted-foreground" colSpan={3}>
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

        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Building2 />
              {m.platform_admin__create_title()}
            </CardTitle>
            <CardDescription>{m.platform_admin__create_description()}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                createOrganization.mutate(form, {
                  onSuccess: () => {
                    setForm(EMPTY_FORM);
                    toast.success(m.platform_admin__created());
                  }
                });
              }}
            >
              <FieldGroup>
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
                  <FieldLabel htmlFor="owner-email">{m.platform_admin__owner_email()}</FieldLabel>
                  <Input
                    id="owner-email"
                    onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })}
                    required
                    type="email"
                    value={form.ownerEmail}
                  />
                </Field>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
