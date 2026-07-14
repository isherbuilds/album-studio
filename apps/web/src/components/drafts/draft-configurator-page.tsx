import { useBlocker, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import {
  type ConfigurationDraftDetail,
  type ConfigurationDraftEditor,
  type ConfigurationDraftState
} from "@tsu-stack/contract/draft";
import { type OrderPriceChange, type OrderPriceComparison } from "@tsu-stack/contract/order";
import { m } from "@tsu-stack/i18n/messages";
import { Button } from "@tsu-stack/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@tsu-stack/ui/components/sheet";

import {
  type DraftCheckpointStatus,
  DraftConfigurator,
  type DraftSnapshotPatch
} from "@/components/drafts/draft-configurator";
import {
  useDraftByIdQuery,
  useReloadDraftMutation,
  useSaveDraftMutation
} from "@/hooks/use-drafts";
import { usePlaceOrderMutation } from "@/hooks/use-orders";

function snapshotFromDraft(draft: ConfigurationDraftDetail): ConfigurationDraftState {
  return {
    projectName: draft.projectName,
    quantity: draft.quantity,
    selections: draft.selections,
    step: draft.step
  };
}

function DraftEditor({
  editor,
  organizationSlug
}: {
  editor: ConfigurationDraftEditor;
  organizationSlug: string;
}) {
  const [currentEditor, setCurrentEditor] = useState(editor);
  const [snapshot, setSnapshot] = useState(() => snapshotFromDraft(editor.draft));
  const [configuratorVersion, setConfiguratorVersion] = useState(0);
  const [saveStatus, setSaveStatus] = useState<DraftCheckpointStatus>("saved");
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<"failed" | "invalid" | null>(null);
  const [priceChange, setPriceChange] = useState<OrderPriceChange | null>(null);
  const navigate = useNavigate();
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef(false);
  const restoreEditorFocus = useRef(false);
  const saveDraft = useSaveDraftMutation(organizationSlug, (revision) => {
    setConflictRevision(revision);
    setSaveStatus(revision === null ? "error" : "conflict");
  });
  const reloadDraft = useReloadDraftMutation(organizationSlug, editor.draft.id);
  const placeOrder = usePlaceOrderMutation(organizationSlug, editor.draft.id, {
    onConfigurationInvalid: ({ issues, product }) => {
      setCurrentEditor((current) => {
        return { ...current, product };
      });
      setCheckoutError("invalid");
      const location = issues
        .map((issue) => issue.location)
        .find(
          (issueLocation) =>
            issueLocation.kind === "group" &&
            product.definition.groups.some((group) => group.key === issueLocation.groupKey)
        );
      setSnapshot((current) => {
        return {
          ...current,
          step:
            location?.kind === "group"
              ? { groupKey: location.groupKey, kind: "group" }
              : { kind: "review" }
        };
      });
    },
    onFailure: () => setCheckoutError("failed"),
    onPlaced: (order) => {
      void navigate({
        params: { orderNumber: order.number, organizationSlug },
        replace: true,
        to: "/org/$organizationSlug/orders/$orderNumber"
      });
    },
    onPriceChanged: (change) => {
      setCurrentEditor((current) => {
        return { ...current, product: change.product };
      });
      setPriceChange(change);
    }
  });
  const isSaving = saveStatus === "saving";
  const isBusy = isSaving || reloadDraft.isPending || placeOrder.isPending;
  const hasUnsavedChanges = saveStatus !== "saved";

  const adoptEditor = (savedEditor: ConfigurationDraftEditor) => {
    setCurrentEditor(savedEditor);
    setSnapshot(snapshotFromDraft(savedEditor.draft));
    setConflictRevision(null);
    reloadDraft.reset();
    setSaveStatus("saved");
  };

  const changeSnapshot = (patch: DraftSnapshotPatch) => {
    setCheckoutError(null);
    setPriceChange(null);
    setSnapshot((current) => {
      return { ...current, ...patch };
    });
    if (saveStatus !== "conflict") setSaveStatus("dirty");
  };

  const saveCheckpoint = async (
    next: ConfigurationDraftState,
    expectedRevision = currentEditor.draft.revision
  ) => {
    if (requestInFlight.current) return false;
    requestInFlight.current = true;
    reloadDraft.reset();
    setSaveStatus("saving");
    try {
      adoptEditor(
        await saveDraft.mutateAsync({
          ...next,
          draftId: currentEditor.draft.id,
          expectedRevision
        })
      );
      return true;
    } catch {
      return false;
    } finally {
      requestInFlight.current = false;
    }
  };

  const transitionStep = (next: ConfigurationDraftState) => {
    if (saveStatus === "conflict") return Promise.resolve(false);
    return saveCheckpoint(next);
  };

  const loadSavedVersion = async () => {
    if (conflictRevision === null || requestInFlight.current) return false;
    requestInFlight.current = true;
    reloadDraft.reset();
    try {
      adoptEditor(await reloadDraft.mutateAsync());
      setConfiguratorVersion((version) => version + 1);
      return true;
    } catch {
      return false;
    } finally {
      requestInFlight.current = false;
    }
  };

  const overwriteLocal = () => {
    if (conflictRevision === null) return Promise.resolve(false);
    return saveCheckpoint(snapshot, conflictRevision);
  };

  const place = async (acceptedPrice: OrderPriceComparison) => {
    setCheckoutError(null);
    setPriceChange(null);
    if (hasUnsavedChanges && !(await saveCheckpoint(snapshot))) return;
    placeOrder.mutate({ acceptedPrice, draftId: currentEditor.draft.id });
  };

  const blocker = useBlocker({
    enableBeforeUnload: () => hasUnsavedChanges,
    shouldBlockFn: () => hasUnsavedChanges,
    withResolver: true
  });

  return (
    <>
      <DraftConfigurator
        checkoutError={checkoutError}
        conflictReloadFailed={reloadDraft.isError}
        isSaving={isBusy}
        isPlacing={placeOrder.isPending}
        key={JSON.stringify([
          configuratorVersion,
          currentEditor.product.definition.groups.map((group) => group.key)
        ])}
        onAcceptServer={() => void loadSavedVersion()}
        onOverwriteLocal={() => void overwriteLocal()}
        onPlaceOrder={(acceptedPrice) => void place(acceptedPrice)}
        onSaveChanges={() => void saveCheckpoint(snapshot)}
        onSnapshotChange={changeSnapshot}
        onStepTransition={transitionStep}
        organizationSlug={organizationSlug}
        payload={currentEditor.product}
        priceChange={priceChange}
        projectNameInputRef={projectNameInputRef}
        saveStatus={saveStatus}
        snapshot={snapshot}
      />

      <Sheet
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") {
            restoreEditorFocus.current = true;
            blocker.reset();
          }
        }}
        open={blocker.status === "blocked"}
      >
        <SheetContent
          onCloseAutoFocus={(event) => {
            if (!restoreEditorFocus.current) return;
            event.preventDefault();
            restoreEditorFocus.current = false;
            projectNameInputRef.current?.focus();
          }}
          side="bottom"
        >
          <SheetHeader>
            <SheetTitle>{m.drafts__leave_title()}</SheetTitle>
            <SheetDescription>{m.drafts__leave_description()}</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button
              onClick={() => {
                if (blocker.status === "blocked") {
                  restoreEditorFocus.current = true;
                  blocker.reset();
                }
              }}
              type="button"
              variant="outline"
            >
              {m.drafts__keep_editing()}
            </Button>
            {saveStatus === "conflict" ? (
              <p className="text-sm text-muted-foreground">{m.drafts__leave_conflict_hint()}</p>
            ) : null}
            <Button
              disabled={isBusy}
              onClick={() =>
                void (saveStatus === "conflict" ? overwriteLocal() : saveCheckpoint(snapshot)).then(
                  (saved) => {
                    if (saved && blocker.status === "blocked") blocker.proceed();
                  }
                )
              }
              type="button"
            >
              {isBusy ? m.drafts__save_saving() : m.drafts__save_and_leave()}
            </Button>
            <Button
              disabled={isBusy}
              onClick={() => {
                if (blocker.status === "blocked") blocker.proceed();
              }}
              type="button"
              variant="destructive"
            >
              {m.drafts__discard_and_leave()}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function DraftConfiguratorPage({
  draftId,
  organizationSlug
}: {
  draftId: string;
  organizationSlug: string;
}) {
  const editor = useDraftByIdQuery(organizationSlug, draftId);
  if (!editor.data) return null;
  return (
    <DraftEditor
      editor={editor.data}
      key={editor.data.draft.id}
      organizationSlug={organizationSlug}
    />
  );
}
