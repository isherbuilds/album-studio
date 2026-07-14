import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { isDefinedError, orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import {
  type ConfigurationDraftEditor,
  type DraftCreateInput,
  type DraftRemoveInput,
  type DraftSaveInput
} from "@tsu-stack/contract/draft";

export function getDraftListQueryOptions(organizationSlug: string) {
  return orpc.drafts.list.queryOptions({ input: { organizationSlug } });
}

export function getDraftByIdQueryOptions(organizationSlug: string, draftId: string) {
  return orpc.drafts.byId.queryOptions({ input: { draftId, organizationSlug } });
}

function updateDraftEditorCache(
  queryClient: QueryClient,
  organizationSlug: string,
  editor: ConfigurationDraftEditor
) {
  queryClient.setQueryData(
    getDraftByIdQueryOptions(organizationSlug, editor.draft.id).queryKey,
    editor
  );
}

export function useDraftListQuery(organizationSlug: string) {
  return useQuery(getDraftListQueryOptions(organizationSlug));
}

export function useDraftByIdQuery(organizationSlug: string, draftId: string) {
  return useQuery(getDraftByIdQueryOptions(organizationSlug, draftId));
}

export function useCreateDraftMutation(organizationSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DraftCreateInput, "organizationSlug">) =>
      orpc.drafts.create.call({ ...input, organizationSlug }),
    onSuccess: async (editor) => {
      updateDraftEditorCache(queryClient, organizationSlug, editor);
      await queryClient.invalidateQueries(getDraftListQueryOptions(organizationSlug));
    }
  });
}

export function useRemoveDraftMutation(organizationSlug: string) {
  const queryClient = useQueryClient();
  const [pendingDraftIds, setPendingDraftIds] = useState<ReadonlySet<string>>(() => new Set());
  const mutation = useMutation({
    mutationFn: (input: Omit<DraftRemoveInput, "organizationSlug">) =>
      orpc.drafts.remove.call({ ...input, organizationSlug }),
    onMutate: (input) => {
      setPendingDraftIds((current) => new Set(current).add(input.draftId));
    },
    onSettled: (_data, _error, input) => {
      setPendingDraftIds((current) => {
        const next = new Set(current);
        next.delete(input.draftId);
        return next;
      });
    },
    onSuccess: async ({ id }) => {
      queryClient.removeQueries(getDraftByIdQueryOptions(organizationSlug, id));
      queryClient.setQueryData(getDraftListQueryOptions(organizationSlug).queryKey, (drafts) =>
        drafts?.filter((draft) => draft.id !== id)
      );
      await queryClient.invalidateQueries(getDraftListQueryOptions(organizationSlug));
    }
  });
  return { ...mutation, pendingDraftIds };
}

export function useSaveDraftMutation(
  organizationSlug: string,
  onFailure: (conflictRevision: number | null) => void
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...orpc.drafts.save.mutationOptions({
      onError: (error) => {
        onFailure(
          isDefinedError(error) && error.code === "DRAFT_CONFLICT" ? error.data.revision : null
        );
      },
      onSuccess: async (editor) => {
        updateDraftEditorCache(queryClient, organizationSlug, editor);
        await queryClient.invalidateQueries(getDraftListQueryOptions(organizationSlug));
      }
    }),
    mutationFn: (input: Omit<DraftSaveInput, "organizationSlug">) =>
      orpc.drafts.save.call({ ...input, organizationSlug })
  });
}

export function useReloadDraftMutation(organizationSlug: string, draftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      queryClient.fetchQuery({
        ...getDraftByIdQueryOptions(organizationSlug, draftId),
        staleTime: 0
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries(getDraftListQueryOptions(organizationSlug));
    }
  });
}
