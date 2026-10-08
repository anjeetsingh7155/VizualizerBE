DROP INDEX "textures_is_active_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "textures" DROP COLUMN "is_active";--> statement-breakpoint
DROP TYPE "public"."user_role";