CREATE TYPE "cancellation_request_status" AS ENUM('none', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "component_availability_override" AS ENUM('automatic', 'available', 'low', 'out');--> statement-breakpoint
CREATE TYPE "configuration_draft_status" AS ENUM('active', 'converted');--> statement-breakpoint
CREATE TYPE "offline_payment_entry_type" AS ENUM('receipt', 'reversal');--> statement-breakpoint
CREATE TYPE "offline_payment_method" AS ENUM('cash', 'bank_transfer', 'upi', 'cheque', 'other');--> statement-breakpoint
CREATE TYPE "option_group_type" AS ENUM('single', 'boolean', 'number');--> statement-breakpoint
CREATE TYPE "order_status" AS ENUM('placed', 'confirmed', 'in_production', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "product_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE SEQUENCE "customer_order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 99999999999 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"action" text NOT NULL,
	"actor_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"id" text PRIMARY KEY,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"organization_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component" (
	"availability_override" "component_availability_override" DEFAULT 'automatic'::"component_availability_override" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"low_stock_threshold" numeric(14,4) DEFAULT '0' NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"quantity" numeric(14,4) DEFAULT '0' NOT NULL,
	"unit" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "component_id_organization_key" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "configuration_draft" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"customer_id" text NOT NULL,
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" "configuration_draft_status" DEFAULT 'active'::"configuration_draft_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "configuration_draft_revision_check" CHECK ("revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_order" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cancellation_status" "cancellation_request_status" DEFAULT 'none'::"cancellation_request_status" NOT NULL,
	"customer_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"id" text PRIMARY KEY,
	"number" text DEFAULT 'AS-S' || lpad(nextval('customer_order_number_seq')::text, 11, '0') NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"project_name" text,
	"snapshot" jsonb NOT NULL,
	"status" "order_status" DEFAULT 'placed'::"order_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"actor_user_id" text NOT NULL,
	"component_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delta" numeric(14,4) NOT NULL,
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "inventory_movement_nonzero_delta_check" CHECK ("delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "invitation_status_check" CHECK ("status" in ('pending', 'accepted', 'rejected', 'canceled')),
	CONSTRAINT "invitation_role_check" CHECK ("role" in ('owner', 'manager', 'customer'))
);
--> statement-breakpoint
CREATE TABLE "member" (
	"created_at" timestamp NOT NULL,
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'customer' NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "member_role_check" CHECK ("role" in ('owner', 'manager', 'customer'))
);
--> statement-breakpoint
CREATE TABLE "offline_payment" (
	"actor_user_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"entry_type" "offline_payment_entry_type" NOT NULL,
	"id" text PRIMARY KEY,
	"method" "offline_payment_method" NOT NULL,
	"mutation_id" text NOT NULL,
	"note" text,
	"order_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"reversal_of_id" text,
	"reversal_target_type" "offline_payment_entry_type",
	CONSTRAINT "offline_payment_amount_minor_range_check" CHECK ("amount_minor" >= -9007199254740991 AND "amount_minor" <= 9007199254740991),
	CONSTRAINT "offline_payment_not_self_reversal_check" CHECK ("reversal_of_id" is null or "reversal_of_id" <> "id"),
	CONSTRAINT "offline_payment_entry_policy_check" CHECK (("entry_type" = 'receipt' and "reversal_of_id" is null and "reversal_target_type" is null and "amount_minor" > 0) or ("entry_type" = 'reversal' and "reversal_of_id" is not null and "reversal_target_type" = 'receipt' and "amount_minor" < 0))
);
--> statement-breakpoint
CREATE TABLE "option_group" (
	"additional_unit_price_minor" bigint,
	"id" text PRIMARY KEY,
	"included" integer,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"maximum" integer,
	"minimum" integer,
	"position" integer NOT NULL,
	"product_id" text NOT NULL,
	"required" boolean NOT NULL,
	"step" integer,
	"type" "option_group_type" NOT NULL,
	CONSTRAINT "option_group_id_product_key" UNIQUE("id","product_id"),
	CONSTRAINT "option_group_additional_unit_price_minor_check" CHECK ("additional_unit_price_minor" IS NULL OR ("additional_unit_price_minor" >= 0 AND "additional_unit_price_minor" <= 9007199254740991))
);
--> statement-breakpoint
CREATE TABLE "option_value" (
	"id" text PRIMARY KEY,
	"image_url" text,
	"label" text NOT NULL,
	"option_group_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"position" integer NOT NULL,
	"price_adjustment_minor" bigint,
	CONSTRAINT "option_value_id_organization_key" UNIQUE("id","organization_id"),
	CONSTRAINT "option_value_id_product_key" UNIQUE("id","product_id"),
	CONSTRAINT "option_value_price_adjustment_minor_check" CHECK ("price_adjustment_minor" >= 0 AND "price_adjustment_minor" <= 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "option_value_component" (
	"component_id" text,
	"option_value_id" text,
	"organization_id" text NOT NULL,
	CONSTRAINT "option_value_component_pkey" PRIMARY KEY("option_value_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "option_value_requirement" (
	"option_value_id" text,
	"prerequisite_option_value_id" text,
	"product_id" text NOT NULL,
	CONSTRAINT "option_value_requirement_pkey" PRIMARY KEY("option_value_id","prerequisite_option_value_id"),
	CONSTRAINT "option_value_requirement_no_self_reference_check" CHECK ("option_value_id" <> "prerequisite_option_value_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"created_at" timestamp NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"id" text PRIMARY KEY,
	"logo" text,
	"metadata" text,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"base_price_minor" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY,
	"image_urls" jsonb DEFAULT '[]' NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"slug" text NOT NULL,
	"status" "product_status" DEFAULT 'draft'::"product_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_id_organization_key" UNIQUE("id","organization_id"),
	CONSTRAINT "product_base_price_minor_check" CHECK ("base_price_minor" >= 0 AND "base_price_minor" <= 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY,
	"active_organization_id" text,
	"impersonated_by" text,
	"ip_address" text,
	"token" text NOT NULL UNIQUE,
	"updated_at" timestamp NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY,
	"image" text,
	"name" text NOT NULL,
	"ban_expires" timestamp,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"role" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");--> statement-breakpoint
CREATE INDEX "audit_event_organization_created_at_idx" ON "audit_event" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "component_organization_idx" ON "component" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "configuration_draft_order_reference_uidx" ON "configuration_draft" ("id","customer_id","organization_id","product_id");--> statement-breakpoint
CREATE INDEX "configuration_draft_customer_active_updated_idx" ON "configuration_draft" ("organization_id","customer_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_order_number_uidx" ON "customer_order" ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_order_draft_uidx" ON "customer_order" ("draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_order_id_organization_uidx" ON "customer_order" ("id","organization_id");--> statement-breakpoint
CREATE INDEX "customer_order_organization_created_idx" ON "customer_order" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_order_customer_created_idx" ON "customer_order" ("organization_id","customer_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_movement_component_created_idx" ON "inventory_movement" ("organization_id","component_id","created_at");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_pending_organization_email_uidx" ON "invitation" ("organization_id",lower("email")) WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_organizationId_userId_uidx" ON "member" ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "offline_payment_order_created_idx" ON "offline_payment" ("organization_id","order_id","created_at");--> statement-breakpoint
CREATE INDEX "offline_payment_reversal_idx" ON "offline_payment" ("reversal_of_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offline_payment_organization_mutation_uidx" ON "offline_payment" ("organization_id","mutation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offline_payment_id_scope_type_uidx" ON "offline_payment" ("id","organization_id","order_id","entry_type");--> statement-breakpoint
CREATE UNIQUE INDEX "option_group_product_key_uidx" ON "option_group" ("product_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "option_group_product_position_uidx" ON "option_group" ("product_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "option_value_group_position_uidx" ON "option_value" ("option_group_id","position");--> statement-breakpoint
CREATE INDEX "option_value_component_component_idx" ON "option_value_component" ("component_id");--> statement-breakpoint
CREATE INDEX "option_value_requirement_prerequisite_idx" ON "option_value_requirement" ("prerequisite_option_value_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "product_organization_slug_uidx" ON "product" ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "product_organization_status_idx" ON "product" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "component" ADD CONSTRAINT "component_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "configuration_draft" ADD CONSTRAINT "configuration_draft_customer_id_user_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "configuration_draft" ADD CONSTRAINT "configuration_draft_product_organization_fkey" FOREIGN KEY ("product_id","organization_id") REFERENCES "product"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_customer_id_user_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_draft_scope_fkey" FOREIGN KEY ("draft_id","customer_id","organization_id","product_id") REFERENCES "configuration_draft"("id","customer_id","organization_id","product_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_product_organization_fkey" FOREIGN KEY ("product_id","organization_id") REFERENCES "product"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_component_organization_fkey" FOREIGN KEY ("component_id","organization_id") REFERENCES "component"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_order_organization_fkey" FOREIGN KEY ("order_id","organization_id") REFERENCES "customer_order"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_reversal_scope_fkey" FOREIGN KEY ("reversal_of_id","organization_id","order_id","reversal_target_type") REFERENCES "offline_payment"("id","organization_id","order_id","entry_type") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "option_group" ADD CONSTRAINT "option_group_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value" ADD CONSTRAINT "option_value_option_group_product_fkey" FOREIGN KEY ("option_group_id","product_id") REFERENCES "option_group"("id","product_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value" ADD CONSTRAINT "option_value_product_organization_fkey" FOREIGN KEY ("product_id","organization_id") REFERENCES "product"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value_component" ADD CONSTRAINT "option_value_component_component_fkey" FOREIGN KEY ("component_id","organization_id") REFERENCES "component"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value_component" ADD CONSTRAINT "option_value_component_option_value_fkey" FOREIGN KEY ("option_value_id","organization_id") REFERENCES "option_value"("id","organization_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value_requirement" ADD CONSTRAINT "option_value_requirement_owner_fkey" FOREIGN KEY ("option_value_id","product_id") REFERENCES "option_value"("id","product_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value_requirement" ADD CONSTRAINT "option_value_requirement_prerequisite_fkey" FOREIGN KEY ("prerequisite_option_value_id","product_id") REFERENCES "option_value"("id","product_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;