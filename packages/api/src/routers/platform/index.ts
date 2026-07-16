import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@tsu-stack/auth/index";
import { PlatformCreateOrganizationInputSchema } from "@tsu-stack/contract/organization";
import { organization, user } from "@tsu-stack/db/schema";

import { platformAdminProcedure } from "#@/lib/procedures/factory";

const organizationSummarySchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.string(),
  name: z.string(),
  slug: z.string()
});

export const platformRouter = {
  organizations: {
    list: platformAdminProcedure
      .route({ description: "List organizations", method: "GET" })
      .input(z.void())
      .output(z.array(organizationSummarySchema))
      .handler(async ({ context }) => {
        const rows = await context.db.select().from(organization).orderBy(organization.name);
        return rows.map((row) => {
          return { ...row, createdAt: row.createdAt.toISOString() };
        });
      }),
    bySlug: platformAdminProcedure
      .route({ description: "Get an organization by slug", method: "GET" })
      .input(z.object({ slug: z.string().min(1) }))
      .output(organizationSummarySchema.nullable())
      .handler(async ({ context, input }) => {
        const rows = await context.db
          .select()
          .from(organization)
          .where(eq(organization.slug, input.slug))
          .limit(1);
        const row = rows[0];
        return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
      }),
    create: platformAdminProcedure
      .route({
        description: "Create an organization and appoint its initial owner",
        method: "POST"
      })
      .input(PlatformCreateOrganizationInputSchema)
      .output(
        organizationSummarySchema.extend({
          ownerCreated: z.boolean(),
          owner: z.object({
            email: z.email(),
            id: z.string(),
            name: z.string()
          })
        })
      )
      .errors({
        ORGANIZATION_SLUG_TAKEN: { message: "Organization slug is already in use", status: 409 }
      })
      .handler(async ({ context, errors, input }) => {
        const existingOrganizations = await context.db
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.slug, input.slug))
          .limit(1);
        if (existingOrganizations.length > 0) throw errors.ORGANIZATION_SLUG_TAKEN();

        const existingUsers = await context.db
          .select({ email: user.email, id: user.id, name: user.name })
          .from(user)
          .where(eq(user.email, input.ownerEmail))
          .limit(1);
        let ownerUser = existingUsers[0];
        let ownerCreated = false;

        if (!ownerUser) {
          try {
            const created = await auth.api.createUser({
              body: {
                email: input.ownerEmail,
                name: input.ownerName,
                password: input.ownerPassword,
                role: "user"
              }
            });
            ownerUser = created.user;
            ownerCreated = true;
          } catch (error) {
            const racedUsers = await context.db
              .select({ email: user.email, id: user.id, name: user.name })
              .from(user)
              .where(eq(user.email, input.ownerEmail))
              .limit(1);
            ownerUser = racedUsers[0];
            if (!ownerUser) throw error;
          }
        }

        let createdOrganization;
        try {
          createdOrganization = await auth.api.createOrganization({
            body: {
              currency: input.currency,
              keepCurrentActiveOrganization: true,
              name: input.name,
              slug: input.slug,
              userId: ownerUser.id
            }
          });
        } catch (error) {
          if (ownerCreated) {
            await auth.api.removeUser({ body: { userId: ownerUser.id } });
          }

          const racedOrganizations = await context.db
            .select({ id: organization.id })
            .from(organization)
            .where(eq(organization.slug, input.slug))
            .limit(1);
          if (racedOrganizations.length > 0) throw errors.ORGANIZATION_SLUG_TAKEN();
          throw error;
        }

        return {
          createdAt: createdOrganization.createdAt.toISOString(),
          id: createdOrganization.id,
          name: createdOrganization.name,
          owner: ownerUser,
          ownerCreated,
          slug: createdOrganization.slug
        };
      })
  }
};
