import { and, desc, eq } from "drizzle-orm";

import {
  ConfigurationDraftDetailSchema,
  ConfigurationDraftListItemSchema,
  type ConfigurationDraftDetail,
  type ConfigurationDraftEditor,
  type ConfigurationDraftListItem
} from "@tsu-stack/contract/draft";
import { type DatabaseOrTransaction } from "@tsu-stack/db";
import { configurationDraft, product } from "@tsu-stack/db/schema";

import { loadPublicProductDefinition } from "#@/catalog/queries";
import { normalizeConfigurationDraftStep } from "#@/draft/step";

type ConfigurationDraftScope = {
  customerId: string;
  draftId: string;
  organizationId: string;
};

export function parseConfigurationDraftDetail(
  row: typeof configurationDraft.$inferSelect,
  productSlug: string
): ConfigurationDraftDetail {
  return ConfigurationDraftDetailSchema.parse({
    ...row.snapshot,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    productId: row.productId,
    productSlug,
    revision: row.revision,
    status: row.status,
    updatedAt: row.updatedAt.toISOString()
  });
}

export async function listConfigurationDrafts(
  db: DatabaseOrTransaction,
  input: { customerId: string; organizationId: string }
): Promise<ConfigurationDraftListItem[]> {
  const rows = await db
    .select({
      id: configurationDraft.id,
      productImageUrls: product.imageUrls,
      productName: product.name,
      productStatus: product.status,
      snapshot: configurationDraft.snapshot,
      updatedAt: configurationDraft.updatedAt
    })
    .from(configurationDraft)
    .innerJoin(
      product,
      and(
        eq(product.id, configurationDraft.productId),
        eq(product.organizationId, configurationDraft.organizationId)
      )
    )
    .where(
      and(
        eq(configurationDraft.organizationId, input.organizationId),
        eq(configurationDraft.customerId, input.customerId),
        eq(configurationDraft.status, "active")
      )
    )
    .orderBy(desc(configurationDraft.updatedAt), desc(configurationDraft.id));

  return rows.map((row) =>
    ConfigurationDraftListItemSchema.parse({
      evaluationSummary: row.snapshot.evaluationSummary,
      id: row.id,
      productName: row.productName,
      projectName: row.snapshot.projectName,
      quantity: row.snapshot.quantity,
      resumable: row.productStatus === "published",
      thumbnailUrl: row.productImageUrls[0] ?? null,
      updatedAt: row.updatedAt.toISOString()
    })
  );
}

export async function loadConfigurationDraftReference(
  db: DatabaseOrTransaction,
  input: ConfigurationDraftScope
): Promise<{ productId: string; revision: number } | undefined> {
  const rows = await db
    .select({ productId: configurationDraft.productId, revision: configurationDraft.revision })
    .from(configurationDraft)
    .innerJoin(
      product,
      and(
        eq(product.id, configurationDraft.productId),
        eq(product.organizationId, configurationDraft.organizationId)
      )
    )
    .where(
      and(
        eq(configurationDraft.id, input.draftId),
        eq(configurationDraft.organizationId, input.organizationId),
        eq(configurationDraft.customerId, input.customerId),
        eq(configurationDraft.status, "active"),
        eq(product.status, "published")
      )
    )
    .limit(1);
  return rows[0];
}

export async function loadConfigurationDraftEditor(
  db: DatabaseOrTransaction,
  input: ConfigurationDraftScope
): Promise<ConfigurationDraftEditor | undefined> {
  const rows = await db
    .select()
    .from(configurationDraft)
    .where(
      and(
        eq(configurationDraft.id, input.draftId),
        eq(configurationDraft.organizationId, input.organizationId),
        eq(configurationDraft.customerId, input.customerId),
        eq(configurationDraft.status, "active")
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;

  const productDefinition = await loadPublicProductDefinition(db, {
    organizationId: input.organizationId,
    productId: row.productId
  });
  if (!productDefinition) return undefined;
  const draft = parseConfigurationDraftDetail(row, productDefinition.slug);

  return {
    draft: {
      ...draft,
      step: normalizeConfigurationDraftStep(draft.step, productDefinition.definition)
    },
    product: productDefinition
  };
}
