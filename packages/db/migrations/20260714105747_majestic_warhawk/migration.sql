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
CREATE INDEX "inventory_movement_component_created_idx" ON "inventory_movement" ("organization_id","component_id","created_at");--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_component_organization_fkey" FOREIGN KEY ("component_id","organization_id") REFERENCES "component"("id","organization_id") ON DELETE CASCADE;
