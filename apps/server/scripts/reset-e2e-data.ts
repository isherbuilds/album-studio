import { eq, inArray, like, or } from "drizzle-orm";

import { db } from "@tsu-stack/db";
import {
  customerOrder,
  inventoryMovement,
  offlinePayment,
  organization
} from "@tsu-stack/db/schema";

const organizations = await db
  .select({ id: organization.id })
  .from(organization)
  .where(or(eq(organization.slug, "demo-studio"), like(organization.slug, "acceptance-studio-%")));
const organizationIds = organizations.map(({ id }) => id);

if (organizationIds.length > 0) {
  await db.transaction(async (tx) => {
    await tx.delete(offlinePayment).where(inArray(offlinePayment.organizationId, organizationIds));
    await tx.delete(customerOrder).where(inArray(customerOrder.organizationId, organizationIds));
    await tx
      .delete(inventoryMovement)
      .where(inArray(inventoryMovement.organizationId, organizationIds));
    await tx.delete(organization).where(inArray(organization.id, organizationIds));
  });
}

console.log("Browser test data reset.");
process.exit(0);
