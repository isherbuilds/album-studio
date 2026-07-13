import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { isDefinedError, orpc } from "@tsu-stack/api/client/tanstack-start/orpc";
import {
  type ConfigurationDraftEditor,
  type DraftCreateInput,
  type DraftRemoveInput,
  type DraftSaveInput
} from "@tsu-stack/contract/draft";

export type DraftSaveSnapshot = Omit<
  DraftSaveInput,
  "draftId" | "expectedRevision" | "organizationSlug"
>;

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
  return useMutation({
    mutationFn: (input: Omit<DraftRemoveInput, "organizationSlug">) =>
      orpc.drafts.remove.call({ ...input, organizationSlug }),
    onSuccess: ({ id }) => {
      queryClient.removeQueries(getDraftByIdQueryOptions(organizationSlug, id));
      queryClient.setQueryData(getDraftListQueryOptions(organizationSlug).queryKey, (drafts) =>
        drafts?.filter((draft) => draft.id !== id)
      );
    }
  });
}

export function useSaveDraftMutation(
  organizationSlug: string,
  onFailure: (conflict: ConfigurationDraftEditor["draft"] | null) => void
) {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.drafts.save.mutationOptions({
      onError: (error) => {
        onFailure(
          isDefinedError(error) && error.code === "DRAFT_CONFLICT" ? error.data.draft : null
        );
      },
      onSuccess: async (editor) => {
        updateDraftEditorCache(queryClient, organizationSlug, editor);
        await queryClient.invalidateQueries(getDraftListQueryOptions(organizationSlug));
      }
    })
  );
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
