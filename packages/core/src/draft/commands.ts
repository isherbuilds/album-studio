import { and, eq, sql } from "drizzle-orm";

import { type ConfigurationSelections } from "@tsu-stack/contract/configuration";
import {
  type ConfigurationDraftEditor,
  type ConfigurationDraftProjectName,
  type ConfigurationDraftState
} from "@tsu-stack/contract/draft";
import { type Database, type DatabaseOrTransaction } from "@tsu-stack/db";
import { configurationDraft } from "@tsu-stack/db/schema";

import { loadPublicProductDefinition } from "#@/catalog/queries";
import { runRepeatableReadTransaction } from "#@/database/run-repeatable-read-transaction";
import { loadConfigurationDraftReference, parseConfigurationDraftDetail } from "#@/draft/queries";
import { createConfigurationDraftSnapshot } from "#@/draft/snapshot";

export async function createConfigurationDraft(
  db: Pick<Database, "transaction">,
  input: {
    customerId: string;
    organizationId: string;
    productSlug: string;
    projectName: ConfigurationDraftProjectName | undefined;
  }
): Promise<ConfigurationDraftEditor | undefined> {
  return runRepeatableReadTransaction(db, async (tx) => {
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
    const firstGroup = productDefinition.definition.groups[0];
    const state: ConfigurationDraftState = {
      projectName: input.projectName ?? null,
      quantity: 1,
      selections,
      step: firstGroup ? { kind: "group", groupKey: firstGroup.key } : { kind: "review" }
    };
    const rows = await tx
      .insert(configurationDraft)
      .values({
        customerId: input.customerId,
        organizationId: input.organizationId,
        productId: productDefinition.definition.id,
        snapshot: createConfigurationDraftSnapshot(productDefinition, state)
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("Configuration Draft insert returned no row");

    return {
      draft: parseConfigurationDraftDetail(row, productDefinition.slug),
      product: productDefinition
    };
  });
}

type SaveConfigurationDraftResult =
  | { kind: "conflict"; revision: number }
  | { kind: "not_found" }
  | { kind: "saved"; editor: ConfigurationDraftEditor };

type SaveConfigurationDraftInput = ConfigurationDraftState & {
  customerId: string;
  draftId: string;
  expectedRevision: number;
  organizationId: string;
};

export async function saveConfigurationDraft(
  db: Pick<Database, "transaction">,
  input: SaveConfigurationDraftInput
): Promise<SaveConfigurationDraftResult> {
  return runRepeatableReadTransaction(db, async (tx) => {
    const candidate = await loadConfigurationDraftReference(tx, input);
    if (!candidate) return { kind: "not_found" };
    if (candidate.revision !== input.expectedRevision) {
      return { kind: "conflict", revision: candidate.revision };
    }

    const productDefinition = await loadPublicProductDefinition(tx, {
      lockProduct: true,
      organizationId: input.organizationId,
      productId: candidate.productId
    });
    if (!productDefinition) return { kind: "not_found" };

    const rows = await tx
      .update(configurationDraft)
      .set({
        revision: sql`${configurationDraft.revision} + 1`,
        snapshot: createConfigurationDraftSnapshot(productDefinition, input)
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
    if (!saved) throw new Error("Configuration Draft CAS update returned no row");

    return {
      kind: "saved",
      editor: {
        draft: parseConfigurationDraftDetail(saved, productDefinition.slug),
        product: productDefinition
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
