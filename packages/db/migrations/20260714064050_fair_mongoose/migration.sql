CREATE SEQUENCE "customer_order_number_seq" MAXVALUE 99999999999;--> statement-breakpoint
ALTER TABLE "customer_order" DROP CONSTRAINT "customer_order_draft_id_configuration_draft_id_fkey";--> statement-breakpoint
ALTER TABLE "customer_order" ALTER COLUMN "number" SET DEFAULT 'AS-S' || lpad(nextval('customer_order_number_seq')::text, 11, '0');--> statement-breakpoint
CREATE UNIQUE INDEX "configuration_draft_order_reference_uidx" ON "configuration_draft" ("id","customer_id","organization_id","product_id");--> statement-breakpoint
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_draft_scope_fkey" FOREIGN KEY ("draft_id","customer_id","organization_id","product_id") REFERENCES "configuration_draft"("id","customer_id","organization_id","product_id") ON DELETE RESTRICT;
