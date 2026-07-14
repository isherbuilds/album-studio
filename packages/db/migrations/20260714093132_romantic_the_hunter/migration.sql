CREATE TYPE "offline_payment_entry_type" AS ENUM('receipt', 'reversal');--> statement-breakpoint
ALTER TABLE "offline_payment" DROP CONSTRAINT "offline_payment_amount_nonzero_check";--> statement-breakpoint
ALTER TABLE "offline_payment" DROP CONSTRAINT "offline_payment_reversal_sign_check";--> statement-breakpoint
ALTER TABLE "offline_payment" DROP CONSTRAINT "offline_payment_reversal_scope_fkey";--> statement-breakpoint
DROP INDEX "offline_payment_id_scope_uidx";--> statement-breakpoint
ALTER TABLE "offline_payment" ADD COLUMN "entry_type" "offline_payment_entry_type";--> statement-breakpoint
ALTER TABLE "offline_payment" ADD COLUMN "mutation_id" text;--> statement-breakpoint
ALTER TABLE "offline_payment" ADD COLUMN "reversal_target_type" "offline_payment_entry_type";--> statement-breakpoint
UPDATE "offline_payment" SET
  "entry_type" = CASE WHEN "reversal_of_id" IS NULL THEN 'receipt'::"offline_payment_entry_type" ELSE 'reversal'::"offline_payment_entry_type" END,
  "mutation_id" = "id",
  "reversal_target_type" = CASE WHEN "reversal_of_id" IS NULL THEN NULL ELSE 'receipt'::"offline_payment_entry_type" END;--> statement-breakpoint
ALTER TABLE "offline_payment" ALTER COLUMN "entry_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "offline_payment" ALTER COLUMN "mutation_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "offline_payment_organization_mutation_uidx" ON "offline_payment" ("organization_id","mutation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offline_payment_id_scope_type_uidx" ON "offline_payment" ("id","organization_id","order_id","entry_type");--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_reversal_scope_fkey" FOREIGN KEY ("reversal_of_id","organization_id","order_id","reversal_target_type") REFERENCES "offline_payment"("id","organization_id","order_id","entry_type") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_amount_minor_range_check" CHECK ("amount_minor" >= -9007199254740991 AND "amount_minor" <= 9007199254740991);--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_not_self_reversal_check" CHECK ("reversal_of_id" is null or "reversal_of_id" <> "id");--> statement-breakpoint
ALTER TABLE "offline_payment" ADD CONSTRAINT "offline_payment_entry_policy_check" CHECK (("entry_type" = 'receipt' and "reversal_of_id" is null and "reversal_target_type" is null and "amount_minor" > 0) or ("entry_type" = 'reversal' and "reversal_of_id" is not null and "reversal_target_type" = 'receipt' and "amount_minor" < 0));
