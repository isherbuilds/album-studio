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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@tsu-stack/ui/components/dialog";

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
  const conflictRevisionRef = useRef<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<"failed" | "invalid" | null>(null);
  const [priceChange, setPriceChange] = useState<OrderPriceChange | null>(null);
  const navigate = useNavigate();
  const requestInFlight = useRef(false);
  const saveDraft = useSaveDraftMutation(organizationSlug, (revision) => {
    conflictRevisionRef.current = revision;
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
        to: "/$organizationSlug/orders/$orderNumber"
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
    conflictRevisionRef.current = null;
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

  const saveCheckpoint = (
    next: ConfigurationDraftState,
    expectedRevision?: number
  ): Promise<boolean> => {
    if (requestInFlight.current) return Promise.resolve(false);
    requestInFlight.current = true;
    reloadDraft.reset();
    setSaveStatus("saving");
    return new Promise((resolve) => {
      saveDraft.mutate(
        {
          ...next,
          draftId: currentEditor.draft.id,
          expectedRevision: expectedRevision ?? currentEditor.draft.revision
        },
        {
          onError: () => resolve(false),
          onSettled: () => {
            requestInFlight.current = false;
          },
          onSuccess: (savedEditor) => {
            adoptEditor(savedEditor);
            resolve(true);
          }
        }
      );
    });
  };

  const transitionStep = (next: ConfigurationDraftState) => {
    if (saveStatus === "conflict") return Promise.resolve(false);
    return saveCheckpoint(next);
  };

  const loadSavedVersion = (): Promise<boolean> => {
    if (conflictRevisionRef.current === null || requestInFlight.current) {
      return Promise.resolve(false);
    }
    requestInFlight.current = true;
    reloadDraft.reset();
    return new Promise((resolve) => {
      reloadDraft.mutate(undefined, {
        onError: () => resolve(false),
        onSettled: () => {
          requestInFlight.current = false;
        },
        onSuccess: (savedEditor) => {
          adoptEditor(savedEditor);
          setConfiguratorVersion((version) => version + 1);
          resolve(true);
        }
      });
    });
  };

  const overwriteLocal = () => {
    if (conflictRevisionRef.current === null) return Promise.resolve(false);
    return saveCheckpoint(snapshot, conflictRevisionRef.current);
  };

  const place = async (acceptedPrice: OrderPriceComparison) => {
    setCheckoutError(null);
    setPriceChange(null);
    if (hasUnsavedChanges && !(await saveCheckpoint(snapshot))) return;
    placeOrder.mutate({ acceptedPrice });
  };

  const blocker = useBlocker({
    enableBeforeUnload: () => hasUnsavedChanges,
    shouldBlockFn: () => hasUnsavedChanges,
    withResolver: true
  });
  const onLeavePromptOpenChange = (open: boolean) => {
    if (!open && blocker.status === "blocked") blocker.reset();
  };
  const leaveActions = (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {saveStatus === "conflict" ? (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          {m.drafts__leave_conflict_hint()}
        </p>
      ) : null}
      <Button
        onClick={() => {
          if (blocker.status === "blocked") blocker.reset();
        }}
        type="button"
        variant="outline"
      >
        {m.drafts__keep_editing()}
      </Button>
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
        className="sm:col-span-2"
        disabled={isBusy}
        onClick={() => {
          if (blocker.status === "blocked") blocker.proceed();
        }}
        type="button"
        variant="destructive"
      >
        {m.drafts__discard_and_leave()}
      </Button>
    </div>
  );

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
        saveStatus={saveStatus}
        snapshot={snapshot}
      />

      {blocker.status === "blocked" ? (
        <Dialog onOpenChange={onLeavePromptOpenChange} open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m.drafts__leave_title()}</DialogTitle>
              <DialogDescription>{m.drafts__leave_description()}</DialogDescription>
            </DialogHeader>
            {leaveActions}
          </DialogContent>
        </Dialog>
      ) : null}
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
