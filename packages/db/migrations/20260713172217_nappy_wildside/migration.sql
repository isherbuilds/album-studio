CREATE TYPE "configuration_draft_status" AS ENUM('active', 'converted');--> statement-breakpoint
CREATE TABLE "configuration_draft" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"customer_id" text NOT NULL,
	"evaluation_summary" jsonb NOT NULL,
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"project_name" text,
	"quantity" double precision NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"selections" jsonb NOT NULL,
	"status" "configuration_draft_status" DEFAULT 'active'::"configuration_draft_status" NOT NULL,
	"step" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "configuration_draft_project_name_check" CHECK ("project_name" IS NULL OR (char_length("project_name") >= 1 AND char_length("project_name") <= 120)),
	CONSTRAINT "configuration_draft_quantity_safe_number_check" CHECK ("quantity" >= -9007199254740991 AND "quantity" <= 9007199254740991),
	CONSTRAINT "configuration_draft_revision_check" CHECK ("revision" > 0)
);
--> statement-breakpoint
CREATE INDEX "configuration_draft_customer_active_updated_idx" ON "configuration_draft" ("organization_id","customer_id","status","updated_at");--> statement-breakpoint
ALTER TABLE "configuration_draft" ADD CONSTRAINT "configuration_draft_customer_id_user_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "configuration_draft" ADD CONSTRAINT "configuration_draft_product_organization_fkey" FOREIGN KEY ("product_id","organization_id") REFERENCES "product"("id","organization_id") ON DELETE CASCADE;