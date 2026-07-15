import { Copy, Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";

import { useAuth } from "@tsu-stack/auth/react/tanstack-start/hooks";
import {
  type OrganizationRole,
  OrganizationCreateInvitationInputSchema,
  OrganizationRoleSchema
} from "@tsu-stack/contract/organization";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@tsu-stack/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@tsu-stack/ui/components/table";

import {
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceStatStrip,
  WorkspaceToolbar
} from "@/components/admin/workspace";
import { TextField } from "@/components/form/text-field";
import { useZodForm } from "@/components/form/use-zod-form";
import {
  useCreateInvitationMutation,
  useListInvitationsQuery,
  useListMembersQuery,
  useRemoveMemberMutation,
  useRevokeInvitationMutation,
  useUpdateMemberRoleMutation
} from "@/hooks/use-organization";

const ROLE_OPTIONS: ReadonlyArray<{
  label: () => string;
  value: OrganizationRole;
}> = [
  { label: m.organization__role_customer, value: "customer" },
  { label: m.organization__role_manager, value: "manager" },
  { label: m.organization__role_owner, value: "owner" }
];

function organizationRoleLabel(value: OrganizationRole) {
  return ROLE_OPTIONS.find((option) => option.value === value)?.label();
}

export function OrganizationMembersPage({ organizationSlug }: { organizationSlug: string }) {
  const members = useListMembersQuery(organizationSlug);
  const invitations = useListInvitationsQuery(organizationSlug);
  const createInvitation = useCreateInvitationMutation(organizationSlug);
  const revokeInvitation = useRevokeInvitationMutation(organizationSlug);
  const removeMember = useRemoveMemberMutation(organizationSlug);
  const updateMemberRole = useUpdateMemberRoleMutation();
  const { isPending: isAuthPending, user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const form = useZodForm(OrganizationCreateInvitationInputSchema, {
    defaultValues: {
      email: "",
      role: "customer"
    }
  });
  const onSubmit = form.handleSubmit((value) => {
    createInvitation.mutate(value, {
      onSuccess: () => {
        form.reset();
        setInviteOpen(false);
        toast.success(m.organization__invited());
      }
    });
  });
  const memberRows = members.data ?? [];
  const invitationRows = invitations.data ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredMembers =
    normalizedSearch === ""
      ? memberRows
      : memberRows.filter(
          (item) =>
            item.name.toLowerCase().includes(normalizedSearch) ||
            item.email.toLowerCase().includes(normalizedSearch)
        );

  return (
    <WorkspacePage>
      <WorkspacePageHeader
        actions={
          <Dialog onOpenChange={setInviteOpen} open={inviteOpen}>
            <DialogTrigger render={<Button />}>
              <UserPlus data-icon="inline-start" />
              {m.organization__invite_title()}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{m.organization__invite_title()}</DialogTitle>
                <DialogDescription>{m.organization__invite_description()}</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit}>
                <FieldGroup>
                  <TextField
                    error={form.formState.errors.email}
                    label={m.organization__invite_email()}
                    registration={form.register("email")}
                    required
                    type="email"
                  />
                  <Controller
                    control={form.control}
                    name="role"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid || undefined}>
                        <FieldLabel htmlFor="invitation-role">
                          {m.organization__invite_role()}
                        </FieldLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(OrganizationRoleSchema.parse(value))
                          }
                          value={field.value}
                        >
                          <SelectTrigger
                            aria-invalid={fieldState.invalid || undefined}
                            className="w-full"
                            id="invitation-role"
                          >
                            <SelectValue>{organizationRoleLabel}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {ROLE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label()}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                  <Field>
                    <Button disabled={createInvitation.isPending} type="submit">
                      {createInvitation.isPending
                        ? m.organization__inviting()
                        : m.organization__invite_action()}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </DialogContent>
          </Dialog>
        }
        description={m.organization__members_description()}
        eyebrow={organizationSlug}
        title={m.organization__members_title()}
      />

      <WorkspaceStatStrip
        label={m.organization__members_title()}
        stats={[
          { label: m.organization__members(), value: memberRows.length },
          { label: m.organization__pending_invitations(), value: invitationRows.length }
        ]}
      />

      <Card className="overflow-hidden py-0" size="sm">
        <WorkspaceToolbar>
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label={m.organization__search_members()}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={m.organization__search_members_placeholder()}
              type="search"
              value={search}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {m.organization__members_card_description()}
          </span>
        </WorkspaceToolbar>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table className="min-w-170">
              <TableHeader>
                <TableRow>
                  <TableHead>{m.organization__member()}</TableHead>
                  <TableHead className="w-52">{m.organization__role()}</TableHead>
                  <TableHead className="w-28 text-right">{m.organization__action()}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="block font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">{item.email}</span>
                    </TableCell>
                    <TableCell>
                      <Select
                        onValueChange={(value) => {
                          updateMemberRole.mutate({
                            memberId: item.id,
                            organizationSlug,
                            role: OrganizationRoleSchema.parse(value)
                          });
                        }}
                        value={item.role}
                      >
                        <SelectTrigger
                          aria-label={`${m.organization__role()}: ${item.name}`}
                          className="w-40"
                        >
                          <SelectValue>{organizationRoleLabel}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label()}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        disabled={isAuthPending || item.userId === user?.id}
                        onClick={() => {
                          if (window.confirm(m.organization__confirm_remove_member())) {
                            removeMember.mutate({ memberId: item.id });
                          }
                        }}
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
        <CardContent className="px-0">
          {invitationRows.length > 0 ? (
            <div className="divide-y">
              {invitationRows.map((item) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
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
                        try {
                          await navigator.clipboard.writeText(item.invitationUrl);
                          toast.success(m.organization__link_copied());
                        } catch {
                          toast.error(m.organization__copy_link_failed());
                        }
                      }}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Copy />
                    </Button>
                    {item.status === "pending" ? (
                      <Button
                        onClick={() => {
                          if (window.confirm(m.organization__confirm_revoke_invitation())) {
                            revokeInvitation.mutate({ invitationId: item.id });
                          }
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {m.organization__revoke()}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {m.organization__no_invitations()}
            </p>
          )}
        </CardContent>
      </Card>
    </WorkspacePage>
  );
}
