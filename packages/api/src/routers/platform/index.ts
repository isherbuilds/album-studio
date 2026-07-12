import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@tsu-stack/auth/index";
import { member, organization, user } from "@tsu-stack/db/schema";

import { platformAdminProcedure } from "#@/lib/procedures/factory";

const organizationSummarySchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string(),
  name: z.string(),
  slug: z.string()
});

const createOrganizationInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  ownerEmail: z.email().transform((email) => email.toLowerCase()),
  ownerName: z.string().trim().min(2).max(120),
  ownerPassword: z.string().min(8).max(128),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
});

export const platformRouter = {
  dashboard: platformAdminProcedure
    .route({ description: "Get installation-wide organization and user counts", method: "GET" })
    .input(z.void())
    .output(
      z.object({
        organizations: z.number().int().nonnegative(),
        roles: z.object({
          customers: z.number().int().nonnegative(),
          managers: z.number().int().nonnegative(),
          owners: z.number().int().nonnegative()
        }),
        users: z.number().int().nonnegative()
      })
    )
    .handler(async ({ context }) => {
      const [stats] = await context.db
        .select({
          customers: sql<number>`count(*) filter (where ${member.role} = 'customer')::int`,
          managers: sql<number>`count(*) filter (where ${member.role} = 'manager')::int`,
          organizations: sql<number>`(select count(*)::int from ${organization})`,
          owners: sql<number>`count(*) filter (where ${member.role} = 'owner')::int`,
          users: sql<number>`(select count(*)::int from ${user})`
        })
        .from(member);

      return {
        organizations: stats?.organizations ?? 0,
        roles: {
          customers: stats?.customers ?? 0,
          managers: stats?.managers ?? 0,
          owners: stats?.owners ?? 0
        },
        users: stats?.users ?? 0
      };
    }),
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
      .input(createOrganizationInputSchema)
      .output(
        organizationSummarySchema.extend({
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
              keepCurrentActiveOrganization: true,
              name: input.name,
              slug: input.slug,
              userId: ownerUser.id
            }
          });
        } catch (error) {
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
          slug: createdOrganization.slug
        };
      })
  }
};
