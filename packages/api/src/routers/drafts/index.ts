import { z } from "zod";

import {
  ConfigurationDraftDetailSchema,
  ConfigurationDraftEditorSchema,
  ConfigurationDraftListItemSchema,
  DraftByIdInputSchema,
  DraftCreateInputSchema,
  DraftListInputSchema,
  DraftRemoveInputSchema,
  DraftRemoveOutputSchema,
  DraftSaveInputSchema
} from "@tsu-stack/contract/draft";
import {
  createConfigurationDraft,
  listConfigurationDrafts,
  loadConfigurationDraftEditor,
  removeConfigurationDraft,
  saveConfigurationDraft
} from "@tsu-stack/core/draft";

import { customerProcedure } from "#@/lib/procedures/factory";

export const draftsRouter = {
  byId: customerProcedure(DraftByIdInputSchema)
    .route({ description: "Load an active Configuration Draft for editing", method: "GET" })
    .output(ConfigurationDraftEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const editor = await context.db.transaction(
        (tx) =>
          loadConfigurationDraftEditor(tx, {
            customerId: context.authSession.user.id,
            draftId: input.draftId,
            organizationId: context.organization.id
          }),
        { accessMode: "read only", isolationLevel: "repeatable read" }
      );
      if (!editor) throw errors.NOT_FOUND({ message: "Configuration Draft not found" });
      return editor;
    }),
  create: customerProcedure(DraftCreateInputSchema)
    .route({ description: "Create a Configuration Draft for a published Product", method: "POST" })
    .output(ConfigurationDraftEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const editor = await context.db.transaction(
        (tx) =>
          createConfigurationDraft(tx, {
            customerId: context.authSession.user.id,
            organizationId: context.organization.id,
            productSlug: input.productSlug,
            projectName: input.projectName
          }),
        { isolationLevel: "repeatable read" }
      );
      if (!editor) throw errors.NOT_FOUND({ message: "Product not found" });
      return editor;
    }),
  list: customerProcedure(DraftListInputSchema)
    .route({ description: "List current Customer's active Configuration Drafts", method: "GET" })
    .output(z.array(ConfigurationDraftListItemSchema))
    .handler(({ context }) =>
      listConfigurationDrafts(context.db, {
        customerId: context.authSession.user.id,
        organizationId: context.organization.id
      })
    ),
  remove: customerProcedure(DraftRemoveInputSchema)
    .route({ description: "Remove an active Configuration Draft", method: "DELETE" })
    .output(DraftRemoveOutputSchema)
    .handler(async ({ context, errors, input }) => {
      const removed = await removeConfigurationDraft(context.db, {
        customerId: context.authSession.user.id,
        draftId: input.draftId,
        organizationId: context.organization.id
      });
      if (!removed) throw errors.NOT_FOUND({ message: "Configuration Draft not found" });
      return { id: input.draftId };
    }),
  save: customerProcedure(DraftSaveInputSchema)
    .route({ description: "Save a full Configuration Draft snapshot", method: "POST" })
    .errors({
      DRAFT_CONFLICT: {
        data: z.object({ draft: ConfigurationDraftDetailSchema }),
        message: "Configuration Draft changed in another session",
        status: 409
      }
    })
    .output(ConfigurationDraftEditorSchema)
    .handler(async ({ context, errors, input }) => {
      const result = await saveConfigurationDraft(context.db, {
        customerId: context.authSession.user.id,
        draftId: input.draftId,
        expectedRevision: input.expectedRevision,
        organizationId: context.organization.id,
        projectName: input.projectName,
        quantity: input.quantity,
        selections: input.selections,
        step: input.step
      });
      if (result.kind === "not_found") {
        throw errors.NOT_FOUND({ message: "Configuration Draft not found" });
      }
      if (result.kind === "conflict") {
        throw errors.DRAFT_CONFLICT({ data: { draft: result.draft } });
      }
      return result.editor;
    })
};
