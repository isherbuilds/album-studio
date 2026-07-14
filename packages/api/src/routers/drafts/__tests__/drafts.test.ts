import { createRouterClient } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { MAX_PRODUCT_OPTION_GROUPS } from "@tsu-stack/contract/configuration";
import { loadPublicProductDefinition } from "@tsu-stack/core/catalog";
import { evaluateConfiguration } from "@tsu-stack/core/configuration";
import { createConfigurationDraft, saveConfigurationDraft } from "@tsu-stack/core/draft";
import { db, type Database } from "@tsu-stack/db";
import {
  configurationDraft,
  member,
  optionGroup,
  optionValue,
  organization,
  product,
  user
} from "@tsu-stack/db/schema";
import { createLogger } from "@tsu-stack/logger/server";

import { appRouter } from "#@/routers/index";

const fixture = {
  customerId: crypto.randomUUID(),
  secondCustomerId: crypto.randomUUID(),
  ownerId: crypto.randomUUID(),
  otherCustomerId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  organizationSlug: `draft-org-${crypto.randomUUID()}`,
  otherOrganizationId: crypto.randomUUID(),
  otherOrganizationSlug: `draft-org-${crypto.randomUUID()}`,
  productId: crypto.randomUUID(),
  productSlug: `album-${crypto.randomUUID()}`,
  unpublishedProductId: crypto.randomUUID(),
  unpublishedProductSlug: `album-${crypto.randomUUID()}`,
  otherProductId: crypto.randomUUID(),
  otherProductSlug: `album-${crypto.randomUUID()}`,
  coverGroupId: crypto.randomUUID(),
  coverValueId: crypto.randomUUID(),
  pagesGroupId: crypto.randomUUID()
};

function createContext(userId: string) {
  const email = `${userId}@example.com`;
  return {
    authSession: {
      session: {
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        updatedAt: new Date(),
        userId
      },
      user: {
        banned: false,
        banExpires: null,
        banReason: null,
        createdAt: new Date(),
        email,
        emailVerified: true,
        id: userId,
        image: null,
        name: "Draft Fixture User",
        role: "user",
        updatedAt: new Date()
      }
    },
    db,
    headers: new Headers(),
    logger: createLogger({ operation: "drafts_router_test" })
  };
}

function clientFor(userId: string) {
  return createRouterClient(appRouter, { context: createContext(userId) }).drafts;
}

function createGate() {
  const controller = new AbortController();
  return {
    promise: new Promise<void>((resolve) => {
      controller.signal.addEventListener("abort", () => resolve(), { once: true });
    }),
    release: () => controller.abort()
  };
}

function databaseTrackingTransactionPid(
  setPid: (pid: number) => void
): Pick<Database, "transaction"> {
  return {
    transaction: (callback, config) =>
      db.transaction(async (tx) => {
        const rows = await tx.execute(sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`);
        const pid = Number(rows[0]?.pid);
        if (!Number.isInteger(pid) || pid <= 0) {
          throw new Error("Transaction has no PostgreSQL backend PID");
        }
        setPid(pid);
        return callback(tx);
      }, config)
  };
}

async function waitForDatabaseLock(pid: () => number) {
  await expect
    .poll(async () => {
      const activity = await db.execute(sql<{ waiting: boolean }>`
        SELECT wait_event_type = 'Lock' AS waiting
        FROM pg_stat_activity
        WHERE pid = ${pid()}
      `);
      return activity[0]?.waiting;
    })
    .toBe(true);
}

beforeAll(async () => {
  await db.insert(user).values(
    [fixture.customerId, fixture.secondCustomerId, fixture.ownerId, fixture.otherCustomerId].map(
      (id) => {
        return {
          email: `${id}@example.com`,
          emailVerified: true,
          id,
          name: "Draft Fixture User",
          role: "user"
        };
      }
    )
  );
  await db.insert(organization).values([
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.organizationId,
      name: "Draft Organization",
      slug: fixture.organizationSlug
    },
    {
      createdAt: new Date(),
      currency: "USD",
      id: fixture.otherOrganizationId,
      name: "Other Draft Organization",
      slug: fixture.otherOrganizationSlug
    }
  ]);
  await db.insert(member).values([
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "customer",
      userId: fixture.customerId
    },
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "customer",
      userId: fixture.secondCustomerId
    },
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "owner",
      userId: fixture.ownerId
    },
    {
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.otherOrganizationId,
      role: "customer",
      userId: fixture.otherCustomerId
    }
  ]);
  await db.insert(product).values([
    {
      basePriceMinor: 10_000,
      id: fixture.productId,
      imageUrls: ["https://example.com/album.png"],
      name: "Wedding Album",
      organizationId: fixture.organizationId,
      slug: fixture.productSlug,
      status: "published"
    },
    {
      basePriceMinor: 9_000,
      id: fixture.unpublishedProductId,
      name: "Hidden Album",
      organizationId: fixture.organizationId,
      slug: fixture.unpublishedProductSlug,
      status: "draft"
    },
    {
      basePriceMinor: 8_000,
      id: fixture.otherProductId,
      name: "Other Album",
      organizationId: fixture.otherOrganizationId,
      slug: fixture.otherProductSlug,
      status: "published"
    }
  ]);
  await db.insert(optionGroup).values([
    {
      id: fixture.coverGroupId,
      key: "cover",
      label: "Cover",
      position: 0,
      productId: fixture.productId,
      required: true,
      type: "single"
    },
    {
      additionalUnitPriceMinor: 100,
      id: fixture.pagesGroupId,
      included: 20,
      key: "pages",
      label: "Pages",
      maximum: 60,
      minimum: 20,
      position: 1,
      productId: fixture.productId,
      required: true,
      step: 10,
      type: "number"
    }
  ]);
  await db.insert(optionValue).values({
    id: fixture.coverValueId,
    label: "Linen",
    optionGroupId: fixture.coverGroupId,
    organizationId: fixture.organizationId,
    position: 0,
    priceAdjustmentMinor: 500,
    productId: fixture.productId
  });
});

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, fixture.organizationId));
  await db.delete(organization).where(eq(organization.id, fixture.otherOrganizationId));
  for (const id of [
    fixture.customerId,
    fixture.secondCustomerId,
    fixture.ownerId,
    fixture.otherCustomerId
  ]) {
    await db.delete(user).where(eq(user.id, id));
  }
});

describe("drafts router", () => {
  it("creates multiple resumable Drafts and lists lightweight active summaries", async () => {
    const client = clientFor(fixture.customerId);

    const first = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug,
      projectName: "  Smith Wedding  "
    });
    const second = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });

    expect(first.draft).toMatchObject({
      productId: fixture.productId,
      productSlug: fixture.productSlug,
      projectName: "Smith Wedding",
      quantity: 1,
      revision: 1,
      selections: { pages: 20 },
      status: "active",
      step: { kind: "group", groupKey: "cover" },
      evaluationSummary: {
        status: "invalid",
        issues: [expect.objectContaining({ code: "missing_selection" })]
      }
    });
    expect(first.product.definition.id).toBe(fixture.productId);
    expect(second.draft.id).not.toBe(first.draft.id);
    expect(second.draft.projectName).toBeNull();

    const list = await client.list({ organizationSlug: fixture.organizationSlug });
    expect(list.map((draft) => draft.id)).toEqual(
      expect.arrayContaining([first.draft.id, second.draft.id])
    );
    const firstSummary = list.find((draft) => draft.id === first.draft.id);
    expect(firstSummary).toMatchObject({
      productName: "Wedding Album",
      projectName: "Smith Wedding",
      resumable: true
    });
    expect(firstSummary).not.toHaveProperty("selections");

    const resumed = await client.byId({
      organizationSlug: fixture.organizationSlug,
      draftId: first.draft.id
    });
    expect(resumed).toEqual(first);
  });

  it("enforces Customer role, Customer ownership, and Organization isolation", async () => {
    const customer = clientFor(fixture.customerId);
    const secondCustomer = clientFor(fixture.secondCustomerId);
    const owner = clientFor(fixture.ownerId);
    const otherCustomer = clientFor(fixture.otherCustomerId);

    await expect(
      owner.create({
        organizationSlug: fixture.organizationSlug,
        productSlug: fixture.productSlug
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", defined: true });

    const created = await customer.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });
    for (const client of [secondCustomer, otherCustomer]) {
      await expect(
        client.byId({
          organizationSlug: fixture.organizationSlug,
          draftId: created.draft.id
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    }

    await expect(
      customer.create({
        organizationSlug: fixture.organizationSlug,
        productSlug: fixture.otherProductSlug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    await expect(
      customer.create({
        organizationSlug: fixture.organizationSlug,
        productSlug: fixture.unpublishedProductSlug
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
  });

  it("returns not found when Product lifecycle change wins the lock", async () => {
    const productId = crypto.randomUUID();
    const productSlug = `create-lock-${crypto.randomUUID()}`;
    await db.insert(product).values({
      basePriceMinor: 10_000,
      id: productId,
      name: "Create Lock Album",
      organizationId: fixture.organizationId,
      slug: productSlug,
      status: "published"
    });

    const lifecycleGate = createGate();
    const state = { createPid: 0, productUpdated: false };
    const lifecycleUpdate = db.transaction(async (tx) => {
      await tx.update(product).set({ status: "archived" }).where(eq(product.id, productId));
      state.productUpdated = true;
      await lifecycleGate.promise;
    });
    const operations: Promise<unknown>[] = [lifecycleUpdate];
    try {
      await expect.poll(() => state.productUpdated).toBe(true);

      const create = createConfigurationDraft(
        databaseTrackingTransactionPid((pid) => {
          state.createPid = pid;
        }),
        {
          customerId: fixture.customerId,
          organizationId: fixture.organizationId,
          productSlug,
          projectName: null
        }
      );
      operations.push(create);
      await expect.poll(() => state.createPid).toBeGreaterThan(0);
      await waitForDatabaseLock(() => state.createPid);

      lifecycleGate.release();
      await expect(create).resolves.toBeUndefined();
    } finally {
      lifecycleGate.release();
      await Promise.allSettled(operations);
    }
  });

  it("blocks Product lifecycle writes while a Draft snapshot transaction is active", async () => {
    const snapshotGate = createGate();
    const state = { productLocked: false, updaterPid: 0 };
    const snapshotTransaction = db.transaction(async (tx) => {
      const snapshot = await loadPublicProductDefinition(tx, {
        lockProduct: true,
        organizationId: fixture.organizationId,
        productId: fixture.productId
      });
      if (!snapshot) throw new Error("Expected published Product snapshot");
      state.productLocked = true;
      await snapshotGate.promise;
    });
    const operations: Promise<unknown>[] = [snapshotTransaction];
    try {
      await expect.poll(() => state.productLocked).toBe(true);
      const lifecycleDb = databaseTrackingTransactionPid((pid) => {
        state.updaterPid = pid;
      });
      const lifecycleUpdate = lifecycleDb.transaction((tx) =>
        tx.update(product).set({ status: "archived" }).where(eq(product.id, fixture.productId))
      );
      operations.push(lifecycleUpdate);
      await expect.poll(() => state.updaterPid).toBeGreaterThan(0);
      await waitForDatabaseLock(() => state.updaterPid);
    } finally {
      snapshotGate.release();
      await Promise.allSettled(operations);
      await db
        .update(product)
        .set({ status: "published" })
        .where(eq(product.id, fixture.productId));
    }
  });

  it("does not deadlock a Draft save against Product cascade deletion", async () => {
    const productId = crypto.randomUUID();
    const productSlug = `deletion-lock-${crypto.randomUUID()}`;
    await db.insert(product).values({
      basePriceMinor: 10_000,
      id: productId,
      name: "Deletion Lock Album",
      organizationId: fixture.organizationId,
      slug: productSlug,
      status: "published"
    });
    const created = await createConfigurationDraft(db, {
      customerId: fixture.customerId,
      organizationId: fixture.organizationId,
      productSlug,
      projectName: null
    });
    if (!created) throw new Error("Expected Draft for deletion lock test");

    const deletionGate = createGate();
    const state = { productLocked: false, savePid: 0 };
    const deletion = db.transaction(async (tx) => {
      await tx
        .select({ id: product.id })
        .from(product)
        .where(eq(product.id, productId))
        .for("update");
      state.productLocked = true;
      await deletionGate.promise;
      await tx.delete(product).where(eq(product.id, productId));
    });
    const operations: Promise<unknown>[] = [deletion];
    try {
      await expect.poll(() => state.productLocked).toBe(true);

      const saveDb = databaseTrackingTransactionPid((pid) => {
        state.savePid = pid;
      });
      const save = saveConfigurationDraft(saveDb, {
        customerId: fixture.customerId,
        draftId: created.draft.id,
        expectedRevision: created.draft.revision,
        organizationId: fixture.organizationId,
        projectName: created.draft.projectName,
        quantity: created.draft.quantity,
        selections: created.draft.selections,
        step: created.draft.step
      });
      operations.push(save);
      await expect.poll(() => state.savePid).toBeGreaterThan(0);
      await waitForDatabaseLock(() => state.savePid);

      deletionGate.release();
      const [, result] = await Promise.all([deletion, save]);
      expect(result).toEqual({ kind: "not_found" });
    } finally {
      deletionGate.release();
      await Promise.allSettled(operations);
    }
  });

  it("persists evaluation summary for normalized snapshot and rejects stale revisions", async () => {
    const client = clientFor(fixture.customerId);
    const created = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });

    const normalized = await client.save({
      organizationSlug: fixture.organizationSlug,
      draftId: created.draft.id,
      expectedRevision: 1,
      projectName: "  Invalid but saved  ",
      quantity: 2,
      selections: { cover: fixture.coverValueId, pages: 20, removedGroup: "old-option" },
      step: { kind: "review" }
    });
    expect(normalized).toMatchObject({
      draft: {
        projectName: "Invalid but saved",
        quantity: 2,
        revision: 2,
        selections: { cover: fixture.coverValueId, pages: 20 },
        step: { kind: "review" },
        evaluationSummary: {
          status: "valid",
          orderTotal: { amountMinor: 21_000, currency: "USD" }
        }
      }
    });
    const persistedEvaluation = evaluateConfiguration({
      availability: normalized.product.availability,
      currency: normalized.product.currency,
      product: normalized.product.definition,
      quantity: normalized.draft.quantity,
      selections: normalized.draft.selections
    });
    expect(normalized.draft.evaluationSummary).toEqual(
      persistedEvaluation.status === "valid"
        ? {
            status: "valid",
            orderTotal: persistedEvaluation.orderTotal,
            perUnitBreakdown: persistedEvaluation.perUnitBreakdown,
            perUnitTotal: persistedEvaluation.perUnitTotal
          }
        : { status: "invalid", issues: persistedEvaluation.issues }
    );

    const latest = await client.save({
      organizationSlug: fixture.organizationSlug,
      draftId: created.draft.id,
      expectedRevision: 2,
      projectName: "Latest safe version",
      quantity: 3,
      selections: { cover: fixture.coverValueId, pages: 20 },
      step: { kind: "review" }
    });
    expect(latest).toMatchObject({
      draft: {
        revision: 3,
        projectName: "Latest safe version",
        evaluationSummary: {
          status: "valid",
          orderTotal: { amountMinor: 31_500, currency: "USD" }
        }
      }
    });

    await expect(
      client.save({
        organizationSlug: fixture.organizationSlug,
        draftId: created.draft.id,
        expectedRevision: 2,
        projectName: "Must not overwrite",
        quantity: 99,
        selections: {},
        step: { kind: "group", groupKey: "cover" }
      })
    ).rejects.toMatchObject({
      code: "DRAFT_CONFLICT",
      defined: true,
      data: { revision: 3 }
    });

    const resumed = await client.byId({
      organizationSlug: fixture.organizationSlug,
      draftId: created.draft.id
    });
    expect(resumed).toEqual(latest);
  });

  it("returns one saved Draft and one typed conflict for simultaneous revisions", async () => {
    const client = clientFor(fixture.customerId);
    const created = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });
    const snapshot = {
      organizationSlug: fixture.organizationSlug,
      draftId: created.draft.id,
      expectedRevision: created.draft.revision,
      quantity: 1,
      selections: { cover: fixture.coverValueId, pages: 20 },
      step: { kind: "review" as const }
    };

    const results = await Promise.allSettled([
      client.save({ ...snapshot, projectName: "Concurrent A" }),
      client.save({ ...snapshot, projectName: "Concurrent B" })
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const saved = fulfilled[0];
    const conflict = rejected[0];
    if (saved?.status !== "fulfilled" || conflict?.status !== "rejected") {
      throw new Error("Expected one saved Draft and one rejected concurrent save");
    }
    expect(saved.value).toMatchObject({
      draft: { id: created.draft.id, revision: 2 },
      product: { definition: { id: fixture.productId } }
    });
    expect(conflict.reason).toMatchObject({
      code: "DRAFT_CONFLICT",
      defined: true,
      data: { revision: 2 }
    });
  });

  it("rejects gross selection snapshots before persistence", async () => {
    const client = clientFor(fixture.customerId);
    const created = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });
    const selections = Object.fromEntries(
      Array.from({ length: MAX_PRODUCT_OPTION_GROUPS + 1 }, (_, index) => [
        `group-${index}`,
        `value-${index}`
      ])
    );

    await expect(
      client.save({
        organizationSlug: fixture.organizationSlug,
        draftId: created.draft.id,
        expectedRevision: created.draft.revision,
        projectName: null,
        quantity: 1,
        selections,
        step: { kind: "review" }
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const unchanged = await client.byId({
      organizationSlug: fixture.organizationSlug,
      draftId: created.draft.id
    });
    expect(unchanged.draft.revision).toBe(created.draft.revision);
  });

  it("reconciles a removed persisted step and stores the safe step on next save", async () => {
    const client = clientFor(fixture.customerId);
    const created = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });
    await db
      .update(configurationDraft)
      .set({
        snapshot: {
          evaluationSummary: created.draft.evaluationSummary,
          projectName: created.draft.projectName,
          quantity: created.draft.quantity,
          selections: created.draft.selections,
          step: { kind: "group", groupKey: "removed-group" }
        }
      })
      .where(eq(configurationDraft.id, created.draft.id));

    await expect(
      client.save({
        organizationSlug: fixture.organizationSlug,
        draftId: created.draft.id,
        expectedRevision: created.draft.revision + 1,
        projectName: created.draft.projectName,
        quantity: created.draft.quantity,
        selections: created.draft.selections,
        step: created.draft.step
      })
    ).rejects.toMatchObject({
      code: "DRAFT_CONFLICT",
      data: { revision: created.draft.revision }
    });

    const resumed = await client.byId({
      organizationSlug: fixture.organizationSlug,
      draftId: created.draft.id
    });
    expect(resumed.draft.step).toEqual({ kind: "group", groupKey: "cover" });

    await client.save({
      organizationSlug: fixture.organizationSlug,
      draftId: created.draft.id,
      expectedRevision: resumed.draft.revision,
      projectName: resumed.draft.projectName,
      quantity: resumed.draft.quantity,
      selections: resumed.draft.selections,
      step: resumed.draft.step
    });
    const rows = await db
      .select({ snapshot: configurationDraft.snapshot })
      .from(configurationDraft)
      .where(eq(configurationDraft.id, created.draft.id));
    expect(rows[0]?.snapshot.step).toEqual({ kind: "group", groupKey: "cover" });
  });

  it("hides inactive Drafts while keeping unpublished Drafts listed and removable", async () => {
    const client = clientFor(fixture.customerId);
    const converted = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });
    await db
      .update(configurationDraft)
      .set({ status: "converted" })
      .where(eq(configurationDraft.id, converted.draft.id));

    await expect(
      client.byId({
        organizationSlug: fixture.organizationSlug,
        draftId: converted.draft.id
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    await expect(
      client.remove({
        organizationSlug: fixture.organizationSlug,
        draftId: converted.draft.id
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    await expect(
      client.save({
        organizationSlug: fixture.organizationSlug,
        draftId: converted.draft.id,
        expectedRevision: converted.draft.revision,
        projectName: null,
        quantity: 1,
        selections: converted.draft.selections,
        step: converted.draft.step
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });

    const unpublished = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });
    await db.update(product).set({ status: "archived" }).where(eq(product.id, fixture.productId));

    const list = await client.list({ organizationSlug: fixture.organizationSlug });
    expect(list.map((draft) => draft.id)).not.toContain(converted.draft.id);
    expect(list.find((draft) => draft.id === unpublished.draft.id)).toMatchObject({
      resumable: false
    });
    await expect(
      client.byId({
        organizationSlug: fixture.organizationSlug,
        draftId: unpublished.draft.id
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    await expect(
      client.save({
        organizationSlug: fixture.organizationSlug,
        draftId: unpublished.draft.id,
        expectedRevision: unpublished.draft.revision,
        projectName: null,
        quantity: 1,
        selections: unpublished.draft.selections,
        step: unpublished.draft.step
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    await expect(
      client.remove({
        organizationSlug: fixture.organizationSlug,
        draftId: unpublished.draft.id
      })
    ).resolves.toEqual({ id: unpublished.draft.id });

    await db.update(product).set({ status: "published" }).where(eq(product.id, fixture.productId));
  });

  it("removes only current Customer's active Draft", async () => {
    const ownerClient = clientFor(fixture.customerId);
    const otherClient = clientFor(fixture.secondCustomerId);
    const created = await ownerClient.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });

    await expect(
      otherClient.remove({
        organizationSlug: fixture.organizationSlug,
        draftId: created.draft.id
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
    await expect(
      ownerClient.remove({
        organizationSlug: fixture.organizationSlug,
        draftId: created.draft.id
      })
    ).resolves.toEqual({ id: created.draft.id });
    await expect(
      ownerClient.byId({
        organizationSlug: fixture.organizationSlug,
        draftId: created.draft.id
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND", defined: true });
  });

  it("retains Draft history when Customer membership is removed", async () => {
    const client = clientFor(fixture.secondCustomerId);
    const active = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });
    const converted = await client.create({
      organizationSlug: fixture.organizationSlug,
      productSlug: fixture.productSlug
    });
    await db
      .update(configurationDraft)
      .set({ status: "converted" })
      .where(eq(configurationDraft.id, converted.draft.id));

    await db
      .delete(member)
      .where(
        and(
          eq(member.organizationId, fixture.organizationId),
          eq(member.userId, fixture.secondCustomerId)
        )
      );

    const retained = await db
      .select({ id: configurationDraft.id, status: configurationDraft.status })
      .from(configurationDraft)
      .where(eq(configurationDraft.customerId, fixture.secondCustomerId));
    expect(retained).toEqual(
      expect.arrayContaining([
        { id: active.draft.id, status: "active" },
        { id: converted.draft.id, status: "converted" }
      ])
    );
    await expect(client.list({ organizationSlug: fixture.organizationSlug })).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
        defined: true
      }
    );

    await db.insert(member).values({
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: fixture.organizationId,
      role: "customer",
      userId: fixture.secondCustomerId
    });
  });

  it("rejects unknown Customer and cross-Organization Product at database boundary", async () => {
    const snapshot = {
      evaluationSummary: {
        status: "invalid" as const,
        issues: [
          {
            code: "missing_selection" as const,
            location: { kind: "group" as const, groupKey: "cover" },
            params: { label: "Cover" }
          }
        ]
      },
      projectName: null,
      quantity: 1,
      selections: {},
      step: { kind: "review" as const }
    };
    await expect(
      db.insert(configurationDraft).values({
        customerId: crypto.randomUUID(),
        organizationId: fixture.organizationId,
        productId: fixture.productId,
        snapshot
      })
    ).rejects.toMatchObject({
      cause: { code: "23503" }
    });
    await expect(
      db.insert(configurationDraft).values({
        customerId: fixture.customerId,
        organizationId: fixture.organizationId,
        productId: fixture.otherProductId,
        snapshot
      })
    ).rejects.toMatchObject({
      cause: { constraint_name: "configuration_draft_product_organization_fkey" }
    });
  });
});
