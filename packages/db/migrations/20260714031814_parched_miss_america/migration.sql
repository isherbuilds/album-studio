CREATE TYPE "order_status" AS ENUM('placed', 'confirmed', 'in_production', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "customer_order" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"customer_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"id" text PRIMARY KEY,
	"number" text DEFAULT 'AS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)) NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"project_name" text,
	"snapshot" jsonb NOT NULL,
	"status" "order_status" DEFAULT 'placed'::"order_status" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "customer_order_number_uidx" ON "customer_order" ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_order_draft_uidx" ON "customer_order" ("draft_id");--> statement-breakpoint
CREATE INDEX "customer_order_organization_created_idx" ON "customer_order" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_order_customer_created_idx" ON "customer_order" ("organization_id","customer_id","created_at");--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_customer_id_user_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_draft_id_configuration_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "configuration_draft"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_product_organization_fkey" FOREIGN KEY ("product_id","organization_id") REFERENCES "product"("id","organization_id") ON DELETE RESTRICT;