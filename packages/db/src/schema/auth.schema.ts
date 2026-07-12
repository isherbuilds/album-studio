import { defineRelationsPart, sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  banExpires: timestamp("ban_expires"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  role: text("role"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull()
});

export const session = pgTable(
  "session",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    activeOrganizationId: text("active_organization_id"),
    impersonatedBy: text("impersonated_by"),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    value: text("value").notNull()
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const organization = pgTable(
  "organization",
  {
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    logo: text("logo"),
    metadata: text("metadata"),
    name: text("name").notNull(),
    slug: text("slug").notNull()
  },
  (table) => [uniqueIndex("organization_slug_uidx").on(table.slug)]
);

export const member = pgTable(
  "member",
  {
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").default("customer").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_organizationId_userId_uidx").on(table.organizationId, table.userId),
    check("member_role_check", sql`${table.role} in ('owner', 'manager', 'customer')`)
  ]
);

export const invitation = pgTable(
  "invitation",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").default("pending").notNull()
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
    uniqueIndex("invitation_pending_organization_email_uidx")
      .on(table.organizationId, sql`lower(${table.email})`)
      .where(sql`${table.status} = 'pending'`),
    check(
      "invitation_status_check",
      sql`${table.status} in ('pending', 'accepted', 'rejected', 'canceled')`
    ),
    check("invitation_role_check", sql`${table.role} in ('owner', 'manager', 'customer')`)
  ]
);

export const relations = defineRelationsPart(
  { account, invitation, member, organization, session, user, verification },
  (r) => {
    return {
      account: {
        user: r.one.user({
          from: r.account.userId,
          to: r.user.id
        })
      },
      session: {
        user: r.one.user({
          from: r.session.userId,
          to: r.user.id
        })
      },
      invitation: {
        organization: r.one.organization({
          from: r.invitation.organizationId,
          to: r.organization.id
        }),
        user: r.one.user({
          from: r.invitation.inviterId,
          to: r.user.id
        })
      },
      member: {
        organization: r.one.organization({
          from: r.member.organizationId,
          to: r.organization.id
        }),
        user: r.one.user({
          from: r.member.userId,
          to: r.user.id
        })
      },
      organization: {
        invitations: r.many.invitation({
          from: r.organization.id,
          to: r.invitation.organizationId
        }),
        members: r.many.member({
          from: r.organization.id,
          to: r.member.organizationId
        })
      },
      user: {
        accounts: r.many.account({
          from: r.user.id,
          to: r.account.userId
        }),
        invitations: r.many.invitation({
          from: r.user.id,
          to: r.invitation.inviterId
        }),
        members: r.many.member({
          from: r.user.id,
          to: r.member.userId
        }),
        sessions: r.many.session({
          from: r.user.id,
          to: r.session.userId
        })
      }
    };
  }
);
