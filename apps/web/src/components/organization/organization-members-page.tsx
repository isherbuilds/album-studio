import { Copy, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { type OrganizationRole, OrganizationRoleSchema } from "@tsu-stack/contract/organization";
import { m } from "@tsu-stack/i18n/messages";
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
  useCreateInvitationMutation,
  useListInvitationsQuery,
  useListMembersQuery,
  useRemoveMemberMutation,
  useRevokeInvitationMutation,
  useUpdateMemberRoleMutation
} from "@/hooks/use-organization";

export function OrganizationMembersPage({ organizationSlug }: { organizationSlug: string }) {
  const members = useListMembersQuery(organizationSlug);
  const invitations = useListInvitationsQuery(organizationSlug);
  const createInvitation = useCreateInvitationMutation(organizationSlug);
  const revokeInvitation = useRevokeInvitationMutation(organizationSlug);
  const removeMember = useRemoveMemberMutation(organizationSlug);
  const updateMemberRole = useUpdateMemberRoleMutation(organizationSlug);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>("customer");
  const [search, setSearch] = useState("");
  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members.data ?? [];
    return members.data?.filter(
      (item) => item.name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query)
    );
  }, [members.data, search]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col gap-1">
        <Badge className="mb-2" variant="outline">
          {organizationSlug}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">{m.organization__members_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.organization__members_description()}</p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>{m.organization__members()}</CardTitle>
              <CardDescription>{m.organization__members_card_description()}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="relative max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label={m.organization__search_members()}
                  className="pl-9"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={m.organization__search_members_placeholder()}
                  value={search}
                />
              </div>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{m.organization__member()}</TableHead>
                      <TableHead>{m.organization__role()}</TableHead>
                      <TableHead className="w-20 text-right">{m.organization__action()}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className="block font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.email}</span>
                        </TableCell>
                        <TableCell>
                          <select
                            aria-label={`${m.organization__role()}: ${item.name}`}
                            className="h-8 rounded-md border bg-background px-2 text-xs capitalize"
                            onChange={(event) => {
                              updateMemberRole.mutate({
                                memberId: item.id,
                                organizationSlug,
                                role: OrganizationRoleSchema.parse(event.target.value)
                              });
                            }}
                            value={item.role}
                          >
                            <option value="customer">{m.organization__role_customer()}</option>
                            <option value="manager">{m.organization__role_manager()}</option>
                            <option value="owner">{m.organization__role_owner()}</option>
                          </select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => removeMember.mutate({ memberId: item.id })}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            {m.organization__remove_member()}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle>{m.organization__pending_invitations()}</CardTitle>
              <CardDescription>{m.organization__invitations_description()}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {invitations.data?.length ? (
                invitations.data.map((item) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    key={item.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="secondary">{item.role}</Badge>
                        <span className="text-xs text-muted-foreground">{item.status}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        aria-label={m.organization__copy_invitation_link()}
                        onClick={async () => {
                          await navigator.clipboard.writeText(item.invitationUrl);
                          toast.success(m.organization__link_copied());
                        }}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <Copy />
                      </Button>
                      {item.status === "pending" ? (
                        <Button
                          onClick={() => revokeInvitation.mutate({ invitationId: item.id })}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {m.organization__revoke()}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {m.organization__no_invitations()}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card size="sm">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <UserPlus />
              {m.organization__invite_title()}
            </CardTitle>
            <CardDescription>{m.organization__invite_description()}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                createInvitation.mutate(
                  { email, role },
                  {
                    onSuccess: () => {
                      setEmail("");
                      toast.success(m.organization__invited());
                    }
                  }
                );
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="invitation-email">
                    {m.organization__invite_email()}
                  </FieldLabel>
                  <Input
                    id="invitation-email"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="invitation-role">{m.organization__invite_role()}</FieldLabel>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    id="invitation-role"
                    onChange={(event) => setRole(OrganizationRoleSchema.parse(event.target.value))}
                    value={role}
                  >
                    <option value="customer">{m.organization__role_customer()}</option>
                    <option value="manager">{m.organization__role_manager()}</option>
                    <option value="owner">{m.organization__role_owner()}</option>
                  </select>
                </Field>
                <Button disabled={createInvitation.isPending} type="submit">
                  {createInvitation.isPending
                    ? m.organization__inviting()
                    : m.organization__invite_action()}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
