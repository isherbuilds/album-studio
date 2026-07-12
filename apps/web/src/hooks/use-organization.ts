import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isDefinedError, type ORPCError } from "@tsu-stack/api/client/tanstack-start/orpc";
import { orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import { authClient } from "@tsu-stack/auth/react/auth-client";
import { getAuthUserQueryOptions } from "@tsu-stack/auth/react/tanstack-start/queries";
import { type OrganizationRole } from "@tsu-stack/contract/organization";
import { m } from "@tsu-stack/i18n/messages";

function showAcceptInvitationError(error: unknown) {
  const definedError = error as ORPCError<string, unknown>;
  if (isDefinedError(definedError)) {
    switch (definedError.code) {
      case "ACCOUNT_EXISTS":
        toast.error(m.auth__account_exists());
        return;
      case "INVITATION_INVALID":
        toast.error(m.auth__invitation_invalid());
        return;
    }
  }
  toast.error(m.auth__invitation_accept_failed());
}

export function getOrganizationMembershipQueryOptions(organizationSlug: string) {
  return orpc.organizations.bySlug.queryOptions({ input: { organizationSlug } });
}

export function useGetOrganizationMembershipQuery(organizationSlug: string) {
  return useQuery(getOrganizationMembershipQueryOptions(organizationSlug));
}

export function listInvitationsQueryOptions(organizationSlug: string) {
  return orpc.organizations.invitations.list.queryOptions({ input: { organizationSlug } });
}

export function useListInvitationsQuery(organizationSlug: string) {
  return useQuery(listInvitationsQueryOptions(organizationSlug));
}

export function listMembersQueryOptions(organizationSlug: string) {
  return orpc.organizations.members.list.queryOptions({ input: { organizationSlug } });
}

export function useListMembersQuery(organizationSlug: string) {
  return useQuery(listMembersQueryOptions(organizationSlug));
}

export function listMyOrganizationsQueryOptions() {
  return orpc.organizations.list.queryOptions();
}

export function useListMyOrganizationsQuery() {
  return useQuery(listMyOrganizationsQueryOptions());
}

export function useCreateInvitationMutation(organizationSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; role: OrganizationRole }) => {
      const organization = await orpc.organizations.bySlug.call({ organizationSlug });
      const result = await authClient.organization.inviteMember({
        email: input.email,
        organizationId: organization.id,
        role: input.role
      });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onError: () => toast.error(m.organization__create_invitation_failed()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.organizations.invitations.list.key({ input: { organizationSlug } })
      });
    }
  });
}

export function useRemoveMemberMutation(organizationSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: string }) => {
      const organization = await orpc.organizations.bySlug.call({ organizationSlug });
      const result = await authClient.organization.removeMember({
        memberIdOrEmail: input.memberId,
        organizationId: organization.id
      });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onError: () => toast.error(m.organization__remove_member_failed()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.organizations.key() });
    }
  });
}

export function useRevokeInvitationMutation(organizationSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { invitationId: string }) => {
      const result = await authClient.organization.cancelInvitation(input);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onError: () => toast.error(m.organization__revoke_invitation_failed()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.organizations.invitations.list.key({ input: { organizationSlug } })
      });
    }
  });
}

export function useUpdateMemberRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.organizations.members.updateRole.mutationOptions({
      onError: (error) => {
        if (isDefinedError(error)) {
          switch (error.code) {
            case "LAST_OWNER":
              toast.error(error.message);
              return;
          }
        }
        toast.error(m.organization__update_role_failed());
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.organizations.key() });
      }
    })
  );
}

export function useAcceptInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { invitationId: string }) => {
      const result = await authClient.organization.acceptInvitation(input);
      if (result.error) throw new Error(result.error.message);
    },
    onError: showAcceptInvitationError,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(getAuthUserQueryOptions()),
        queryClient.invalidateQueries({ queryKey: orpc.organizations.list.key() })
      ]);
    }
  });
}

export function useAcceptNewUserInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { invitationId: string; name: string; password: string }) => {
      const result = await orpc.organizations.invitations.acceptNewUser.call(input);
      const signIn = await authClient.signIn.email({
        email: result.email,
        password: input.password
      });
      if (!signIn.data) {
        throw new Error(signIn.error?.message ?? m.auth__invitation_sign_in_failed());
      }
      return result;
    },
    onError: showAcceptInvitationError,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries(getAuthUserQueryOptions()),
        queryClient.invalidateQueries({ queryKey: orpc.organizations.list.key() })
      ]);
    }
  });
}
