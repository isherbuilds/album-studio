CREATE TYPE "component_availability_override" AS ENUM('automatic', 'available', 'low', 'out');--> statement-breakpoint
CREATE TYPE "option_group_type" AS ENUM('single', 'boolean', 'number');--> statement-breakpoint
CREATE TYPE "product_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "component" (
	"availability_override" "component_availability_override" DEFAULT 'automatic'::"component_availability_override" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"low_stock_threshold" numeric(14,4) DEFAULT '0' NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"quantity" numeric(14,4) DEFAULT '0' NOT NULL,
	"unit" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	CONSTRAINT "option_group_number_fields_check" CHECK ("type" <> 'number' OR ("minimum" IS NOT NULL AND "maximum" IS NOT NULL AND "step" IS NOT NULL AND "included" IS NOT NULL AND "additional_unit_price_minor" IS NOT NULL AND "step" > 0))
);
--> statement-breakpoint
CREATE TABLE "option_value" (
	"id" text PRIMARY KEY,
	"image_url" text,
	"label" text NOT NULL,
	"option_group_id" text NOT NULL,
	"position" integer NOT NULL,
	"price_adjustment_minor" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_value_component" (
	"component_id" text,
	"option_value_id" text,
	CONSTRAINT "option_value_component_pkey" PRIMARY KEY("option_value_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "option_value_requirement" (
	"option_value_id" text,
	"prerequisite_option_value_id" text,
	CONSTRAINT "option_value_requirement_pkey" PRIMARY KEY("option_value_id","prerequisite_option_value_id")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"base_price_minor" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY,
	"image_urls" jsonb DEFAULT '[]' NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"slug" text NOT NULL,
	"status" "product_status" DEFAULT 'draft'::"product_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
CREATE INDEX "component_organization_idx" ON "component" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "option_group_product_key_uidx" ON "option_group" ("product_id","key");--> statement-breakpoint
CREATE INDEX "option_group_product_position_idx" ON "option_group" ("product_id","position");--> statement-breakpoint
CREATE INDEX "option_value_group_position_idx" ON "option_value" ("option_group_id","position");--> statement-breakpoint
CREATE INDEX "option_value_component_component_idx" ON "option_value_component" ("component_id");--> statement-breakpoint
CREATE INDEX "option_value_requirement_prerequisite_idx" ON "option_value_requirement" ("prerequisite_option_value_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_organization_slug_uidx" ON "product" ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "product_organization_status_idx" ON "product" ("organization_id","status");--> statement-breakpoint
ALTER TABLE "component" ADD CONSTRAINT "component_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_group" ADD CONSTRAINT "option_group_product_id_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value" ADD CONSTRAINT "option_value_option_group_id_option_group_id_fkey" FOREIGN KEY ("option_group_id") REFERENCES "option_group"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value_component" ADD CONSTRAINT "option_value_component_component_id_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "component"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value_component" ADD CONSTRAINT "option_value_component_option_value_id_option_value_id_fkey" FOREIGN KEY ("option_value_id") REFERENCES "option_value"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value_requirement" ADD CONSTRAINT "option_value_requirement_option_value_id_option_value_id_fkey" FOREIGN KEY ("option_value_id") REFERENCES "option_value"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "option_value_requirement" ADD CONSTRAINT "option_value_requirement_7b8pRIbgYCJG_fkey" FOREIGN KEY ("prerequisite_option_value_id") REFERENCES "option_value"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;