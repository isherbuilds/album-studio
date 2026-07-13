import { and, desc, eq } from "drizzle-orm";

import {
  ConfigurationDraftDetailSchema,
  ConfigurationDraftEditorSchema,
  ConfigurationDraftListItemSchema,
  type ConfigurationDraftDetail,
  type ConfigurationDraftEditor,
  type ConfigurationDraftListItem
} from "@tsu-stack/contract/draft";
import { type DatabaseOrTransaction } from "@tsu-stack/db";
import { configurationDraft, product } from "@tsu-stack/db/schema";

import { loadPublicProductDefinition } from "#@/catalog/queries";
import { normalizeConfigurationDraftStep } from "#@/draft/step";

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
      draft: configurationDraft,
      productImageUrls: product.imageUrls,
      productName: product.name,
      productSlug: product.slug,
      productStatus: product.status
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

  return rows.map((row) => {
    const draft = parseConfigurationDraftDetail(row.draft, row.productSlug);
    return ConfigurationDraftListItemSchema.parse({
      ...draft,
      productName: row.productName,
      resumable: row.productStatus === "published",
      thumbnailUrl: row.productImageUrls[0] ?? null
    });
  });
}

export async function loadConfigurationDraft(
  db: DatabaseOrTransaction,
  input: { customerId: string; draftId: string; organizationId: string }
): Promise<ConfigurationDraftDetail | undefined> {
  const rows = await db
    .select({ draft: configurationDraft, productSlug: product.slug })
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
  const row = rows[0];
  return row ? parseConfigurationDraftDetail(row.draft, row.productSlug) : undefined;
}

export async function loadConfigurationDraftEditor(
  db: DatabaseOrTransaction,
  input: { customerId: string; draftId: string; organizationId: string }
): Promise<ConfigurationDraftEditor | undefined> {
  const draft = await loadConfigurationDraft(db, input);
  if (!draft) return undefined;

  const productDefinition = await loadPublicProductDefinition(db, {
    organizationId: input.organizationId,
    productId: draft.productId
  });
  if (!productDefinition) return undefined;

  return ConfigurationDraftEditorSchema.parse({
    draft: {
      ...draft,
      step: normalizeConfigurationDraftStep(draft.step, productDefinition.definition)
    },
    product: productDefinition
  });
}
