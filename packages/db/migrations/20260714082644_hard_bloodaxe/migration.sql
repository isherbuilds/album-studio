CREATE TYPE "cancellation_request_status" AS ENUM('none', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "offline_payment_method" AS ENUM('cash', 'bank_transfer', 'upi', 'cheque', 'other');--> statement-breakpoint
CREATE TABLE "offline_payment" (
	"actor_user_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"method" "offline_payment_method" NOT NULL,
	"note" text,
	"order_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"reversal_of_id" text,
	CONSTRAINT "offline_payment_amount_nonzero_check" CHECK ("amount_minor" <> 0),
	CONSTRAINT "offline_payment_reversal_sign_check" CHECK (("reversal_of_id" is null and "amount_minor" > 0) or ("reversal_of_id" is not null and "amount_minor" < 0))
);
--> statement-breakpoint
ALTER TABLE "customer_order" ADD COLUMN "cancellation_status" "cancellation_request_status" DEFAULT 'none'::"cancellation_request_status" NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_order_id_organization_uidx" ON "customer_order" ("id","organization_id");--> statement-breakpoint
CREATE INDEX "offline_payment_order_created_idx" ON "offline_payment" ("organization_id","order_id","created_at");--> statement-breakpoint
CREATE INDEX "offline_payment_reversal_idx" ON "offline_payment" ("reversal_of_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offline_payment_id_scope_uidx" ON "offline_payment" ("id","organization_id","order_id");--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_order_organization_fkey" FOREIGN KEY ("order_id","organization_id") REFERENCES "customer_order"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_reversal_scope_fkey" FOREIGN KEY ("reversal_of_id","organization_id","order_id") REFERENCES "offline_payment"("id","organization_id","order_id") ON DELETE RESTRICT;