import { and, eq, exists, sql } from "drizzle-orm";

import {
  type ConfigurationEvaluation,
  type ConfigurationSelections,
  type EvaluateConfigurationInput
} from "@tsu-stack/contract/configuration";
import {
  ConfigurationDraftEditorSchema,
  type ConfigurationDraftDetail,
  type ConfigurationDraftEditor,
  type ConfigurationDraftEvaluationSummary,
  type ConfigurationDraftProjectName,
  type ConfigurationDraftStep
} from "@tsu-stack/contract/draft";
import { type Database, type DatabaseOrTransaction } from "@tsu-stack/db";
import { configurationDraft, product } from "@tsu-stack/db/schema";

import { loadPublicProductDefinition } from "#@/catalog/queries";
import { evaluateConfiguration } from "#@/configuration/evaluate-configuration";
import {
  loadConfigurationDraft,
  loadConfigurationDraftEditor,
  parseConfigurationDraftDetail
} from "#@/draft/queries";
import { normalizeConfigurationDraftStep } from "#@/draft/step";

function summarizeConfigurationEvaluation(
  evaluation: ConfigurationEvaluation
): ConfigurationDraftEvaluationSummary {
  return evaluation.status === "valid"
    ? { status: "valid", orderTotal: evaluation.orderTotal }
    : { status: "invalid", issues: evaluation.issues };
}

function sameSelections(left: ConfigurationSelections, right: ConfigurationSelections): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

function evaluatePersistedSnapshot(input: EvaluateConfigurationInput): ConfigurationEvaluation {
  const evaluation = evaluateConfiguration(input);
  return sameSelections(input.selections, evaluation.normalizedSelections)
    ? evaluation
    : evaluateConfiguration({ ...input, selections: evaluation.normalizedSelections });
}

export async function createConfigurationDraft(
  db: DatabaseOrTransaction,
  input: {
    customerId: string;
    organizationId: string;
    productSlug: string;
    projectName: ConfigurationDraftProjectName | undefined;
  }
): Promise<ConfigurationDraftEditor | undefined> {
  const productDefinition = await loadPublicProductDefinition(db, {
    organizationId: input.organizationId,
    productSlug: input.productSlug
  });
  if (!productDefinition) return undefined;

  const selections: ConfigurationSelections = Object.fromEntries(
    productDefinition.definition.groups.flatMap((group) =>
      group.type === "number" ? [[group.key, group.included]] : []
    )
  );
  const quantity = 1;
  const evaluation = evaluatePersistedSnapshot({
    availability: productDefinition.availability,
    currency: productDefinition.currency,
    product: productDefinition.definition,
    quantity,
    selections
  });
  const firstGroup = productDefinition.definition.groups[0];
  const step: ConfigurationDraftStep = firstGroup
    ? { kind: "group", groupKey: firstGroup.key }
    : { kind: "review" };
  const rows = await db
    .insert(configurationDraft)
    .values({
      customerId: input.customerId,
      evaluationSummary: summarizeConfigurationEvaluation(evaluation),
      organizationId: input.organizationId,
      productId: productDefinition.definition.id,
      projectName: input.projectName ?? null,
      quantity,
      selections: evaluation.normalizedSelections,
      step
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Configuration Draft insert returned no row");

  return ConfigurationDraftEditorSchema.parse({
    draft: parseConfigurationDraftDetail(row, productDefinition.slug),
    product: productDefinition
  });
}

export type SaveConfigurationDraftResult =
  | { kind: "conflict"; draft: ConfigurationDraftDetail }
  | { kind: "not_found" }
  | { kind: "saved"; editor: ConfigurationDraftEditor };

type SaveConfigurationDraftInput = {
  customerId: string;
  draftId: string;
  expectedRevision: number;
  organizationId: string;
  projectName: ConfigurationDraftProjectName;
  quantity: number;
  selections: ConfigurationSelections;
  step: ConfigurationDraftStep;
};

async function prepareConfigurationDraftSave(
  db: Pick<Database, "transaction">,
  input: SaveConfigurationDraftInput
) {
  return db.transaction(
    async (tx) => {
      const current = await loadConfigurationDraft(tx, input);
      if (!current) return { kind: "not_found" } as const;

      const productDefinition = await loadPublicProductDefinition(tx, {
        organizationId: input.organizationId,
        productId: current.productId
      });
      if (!productDefinition) return { kind: "not_found" } as const;
      const definition = productDefinition.definition;
      const safeCurrent = {
        ...current,
        step: normalizeConfigurationDraftStep(current.step, definition)
      };
      if (current.revision !== input.expectedRevision) {
        return { kind: "conflict", draft: safeCurrent } as const;
      }

      const evaluation = evaluatePersistedSnapshot({
        availability: productDefinition.availability,
        currency: productDefinition.currency,
        product: definition,
        quantity: input.quantity,
        selections: input.selections
      });
      return {
        kind: "ready",
        current: safeCurrent,
        evaluationSummary: summarizeConfigurationEvaluation(evaluation),
        normalizedSelections: evaluation.normalizedSelections,
        productDefinition,
        step: normalizeConfigurationDraftStep(input.step, definition)
      } as const;
    },
    { accessMode: "read only", isolationLevel: "repeatable read" }
  );
}

export async function saveConfigurationDraft(
  db: Pick<Database, "select" | "transaction" | "update">,
  input: SaveConfigurationDraftInput
): Promise<SaveConfigurationDraftResult> {
  const prepared = await prepareConfigurationDraftSave(db, input);
  if (prepared.kind !== "ready") return prepared;

  const publishedProduct = db
    .select({ id: product.id })
    .from(product)
    .where(
      and(
        eq(product.id, prepared.current.productId),
        eq(product.organizationId, input.organizationId),
        eq(product.status, "published")
      )
    );
  const rows = await db
    .update(configurationDraft)
    .set({
      evaluationSummary: prepared.evaluationSummary,
      projectName: input.projectName,
      quantity: input.quantity,
      revision: sql`${configurationDraft.revision} + 1`,
      selections: prepared.normalizedSelections,
      step: prepared.step,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(configurationDraft.id, input.draftId),
        eq(configurationDraft.organizationId, input.organizationId),
        eq(configurationDraft.customerId, input.customerId),
        eq(configurationDraft.productId, prepared.current.productId),
        eq(configurationDraft.status, "active"),
        eq(configurationDraft.revision, input.expectedRevision),
        exists(publishedProduct)
      )
    )
    .returning();
  const saved = rows[0];
  if (saved) {
    return {
      kind: "saved",
      editor: ConfigurationDraftEditorSchema.parse({
        draft: parseConfigurationDraftDetail(saved, prepared.current.productSlug),
        product: prepared.productDefinition
      })
    };
  }

  const latest = await db.transaction((tx) => loadConfigurationDraftEditor(tx, input), {
    accessMode: "read only",
    isolationLevel: "repeatable read"
  });
  if (!latest) return { kind: "not_found" };
  if (latest.draft.revision === input.expectedRevision) {
    throw new Error("Configuration Draft CAS failed without a revision or lifecycle change");
  }
  return { kind: "conflict", draft: latest.draft };
}

export async function removeConfigurationDraft(
  db: DatabaseOrTransaction,
  input: { customerId: string; draftId: string; organizationId: string }
): Promise<boolean> {
  const rows = await db
    .delete(configurationDraft)
    .where(
      and(
        eq(configurationDraft.id, input.draftId),
        eq(configurationDraft.organizationId, input.organizationId),
        eq(configurationDraft.customerId, input.customerId),
        eq(configurationDraft.status, "active")
      )
    )
    .returning({ id: configurationDraft.id });
  return rows.length === 1;
}
