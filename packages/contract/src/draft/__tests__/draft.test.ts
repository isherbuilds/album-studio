import { describe, expect, it } from "vite-plus/test";

import {
  MAX_OPTION_GROUP_KEY_LENGTH,
  MAX_OPTION_VALUE_ID_LENGTH,
  MAX_PRODUCT_OPTION_GROUPS
} from "#@/configuration/index";
import {
  ConfigurationDraftDetailSchema,
  ConfigurationDraftStepSchema,
  DraftCreateInputSchema,
  DraftSaveInputSchema
} from "#@/draft/index";

describe("Configuration Draft contracts", () => {
  it("normalizes optional Project Names at inbound boundaries", () => {
    expect(
      DraftCreateInputSchema.parse({
        organizationSlug: "studio",
        productSlug: "album",
        projectName: "  Smith Wedding  "
      }).projectName
    ).toBe("Smith Wedding");
    expect(
      DraftCreateInputSchema.parse({
        organizationSlug: "studio",
        productSlug: "album",
        projectName: "   "
      }).projectName
    ).toBeNull();
    expect(
      DraftCreateInputSchema.safeParse({
        organizationSlug: "studio",
        productSlug: "album",
        projectName: "x".repeat(121)
      }).success
    ).toBe(false);
  });

  it("accepts stable group and review step discriminators", () => {
    expect(ConfigurationDraftStepSchema.parse({ kind: "group", groupKey: "cover" })).toEqual({
      kind: "group",
      groupKey: "cover"
    });
    expect(ConfigurationDraftStepSchema.parse({ kind: "review" })).toEqual({ kind: "review" });
  });

  it("allows evaluator-invalid finite snapshot state while rejecting unsafe transport numbers", () => {
    const invalidDraft = {
      draftId: "draft-1",
      expectedRevision: 1,
      organizationSlug: "studio",
      projectName: null,
      quantity: 0.5,
      selections: { pages: 21 },
      step: { kind: "review" }
    };
    expect(DraftSaveInputSchema.safeParse(invalidDraft).success).toBe(true);
    expect(
      DraftSaveInputSchema.safeParse({ ...invalidDraft, quantity: Number.POSITIVE_INFINITY })
        .success
    ).toBe(false);
  });

  it("bounds full Draft selection snapshots before evaluation", () => {
    const draft = {
      draftId: "draft-1",
      expectedRevision: 1,
      organizationSlug: "studio",
      projectName: null,
      quantity: 1,
      step: { kind: "review" }
    };
    const maximumSelections = Object.fromEntries(
      Array.from({ length: MAX_PRODUCT_OPTION_GROUPS }, (_, index) => [
        `group-${index}`,
        `value-${index}`
      ])
    );
    expect(
      DraftSaveInputSchema.safeParse({ ...draft, selections: maximumSelections }).success
    ).toBe(true);
    expect(
      DraftSaveInputSchema.safeParse({
        ...draft,
        selections: {
          ...maximumSelections,
          overflow: "value-overflow"
        }
      }).success
    ).toBe(false);
    expect(
      DraftSaveInputSchema.safeParse({
        ...draft,
        selections: { ["g".repeat(MAX_OPTION_GROUP_KEY_LENGTH + 1)]: "value" }
      }).success
    ).toBe(false);
    expect(
      DraftSaveInputSchema.safeParse({
        ...draft,
        selections: {
          cover: "v".repeat(MAX_OPTION_VALUE_ID_LENGTH + 1)
        }
      }).success
    ).toBe(false);

    const detail = {
      createdAt: new Date().toISOString(),
      evaluationSummary: {
        status: "valid" as const,
        orderTotal: { amountMinor: 10_000, currency: "USD" }
      },
      id: "draft-1",
      productId: "product-1",
      productSlug: "album",
      projectName: null,
      quantity: 1,
      revision: 1,
      status: "active" as const,
      step: { kind: "review" as const },
      updatedAt: new Date().toISOString()
    };
    expect(
      ConfigurationDraftDetailSchema.safeParse({
        ...detail,
        selections: maximumSelections
      }).success
    ).toBe(true);
    expect(
      ConfigurationDraftDetailSchema.safeParse({
        ...detail,
        selections: { ...maximumSelections, overflow: "value-overflow" }
      }).success
    ).toBe(false);
  });
});
