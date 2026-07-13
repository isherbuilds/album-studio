import { and, eq, sql } from "drizzle-orm";

import { type ConfigurationSelections } from "@tsu-stack/contract/configuration";
import {
  ConfigurationDraftEditorSchema,
  type ConfigurationDraftDetail,
  type ConfigurationDraftEditor,
  type ConfigurationDraftProjectName,
  type ConfigurationDraftStep
} from "@tsu-stack/contract/draft";
import { type Database, type DatabaseOrTransaction } from "@tsu-stack/db";
import { configurationDraft } from "@tsu-stack/db/schema";

import { loadPublicProductDefinition } from "#@/catalog/queries";
import { loadConfigurationDraft, parseConfigurationDraftDetail } from "#@/draft/queries";
import { createConfigurationDraftSnapshot } from "#@/draft/snapshot";
import { normalizeConfigurationDraftStep } from "#@/draft/step";

export async function createConfigurationDraft(
  db: Pick<Database, "transaction">,
  input: {
    customerId: string;
    organizationId: string;
    productSlug: string;
    projectName: ConfigurationDraftProjectName | undefined;
  }
): Promise<ConfigurationDraftEditor | undefined> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.transaction(
        async (tx) => {
          const productDefinition = await loadPublicProductDefinition(tx, {
            lockProduct: true,
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
          const firstGroup = productDefinition.definition.groups[0];
          const step: ConfigurationDraftStep = firstGroup
            ? { kind: "group", groupKey: firstGroup.key }
            : { kind: "review" };
          const snapshot = createConfigurationDraftSnapshot({
            availability: productDefinition.availability,
            currency: productDefinition.currency,
            product: productDefinition.definition,
            projectName: input.projectName ?? null,
            quantity,
            selections,
            step
          });
          const rows = await tx
            .insert(configurationDraft)
            .values({
              customerId: input.customerId,
              organizationId: input.organizationId,
              productId: productDefinition.definition.id,
              snapshot
            })
            .returning();
          const row = rows[0];
          if (!row) throw new Error("Configuration Draft insert returned no row");

          return ConfigurationDraftEditorSchema.parse({
            draft: parseConfigurationDraftDetail(row, productDefinition.slug),
            product: productDefinition
          });
        },
        { isolationLevel: "repeatable read" }
      );
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof Error &&
        error.cause instanceof Error &&
        "code" in error.cause &&
        error.cause.code === "40001"
      ) {
        continue;
      }
      throw error;
    }
  }
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

export async function saveConfigurationDraft(
  db: Pick<Database, "transaction">,
  input: SaveConfigurationDraftInput
): Promise<SaveConfigurationDraftResult> {
  return db.transaction(async (tx) => {
    const candidate = await loadConfigurationDraft(tx, input);
    if (!candidate) return { kind: "not_found" };

    const productDefinition = await loadPublicProductDefinition(tx, {
      lockProduct: true,
      organizationId: input.organizationId,
      productId: candidate.productId
    });
    if (!productDefinition) return { kind: "not_found" };

    const snapshot = createConfigurationDraftSnapshot({
      availability: productDefinition.availability,
      currency: productDefinition.currency,
      product: productDefinition.definition,
      projectName: input.projectName,
      quantity: input.quantity,
      selections: input.selections,
      step: normalizeConfigurationDraftStep(input.step, productDefinition.definition)
    });

    const rows = await tx
      .update(configurationDraft)
      .set({
        revision: sql`${configurationDraft.revision} + 1`,
        snapshot,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(configurationDraft.id, input.draftId),
          eq(configurationDraft.organizationId, input.organizationId),
          eq(configurationDraft.customerId, input.customerId),
          eq(configurationDraft.productId, productDefinition.definition.id),
          eq(configurationDraft.status, "active"),
          eq(configurationDraft.revision, input.expectedRevision)
        )
      )
      .returning();
    const saved = rows[0];
    if (saved) {
      return {
        kind: "saved",
        editor: ConfigurationDraftEditorSchema.parse({
          draft: parseConfigurationDraftDetail(saved, productDefinition.slug),
          product: productDefinition
        })
      };
    }

    const latest = await loadConfigurationDraft(tx, input);
    if (!latest || latest.productId !== productDefinition.definition.id) {
      return { kind: "not_found" };
    }
    return {
      kind: "conflict",
      draft: {
        ...latest,
        step: normalizeConfigurationDraftStep(latest.step, productDefinition.definition)
      }
    };
  });
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
