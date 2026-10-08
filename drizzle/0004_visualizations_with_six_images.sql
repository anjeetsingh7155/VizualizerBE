-- Old-style generation rows (from the room-photo design) cannot be shown in the new six-image design, so they are removed first. No generation feature existed before, so this table is normally empty.
DELETE FROM "generations";--> statement-breakpoint
CREATE TYPE "public"."space_type" AS ENUM('living_room_floor', 'bedroom_floor', 'kitchen', 'bathroom', 'staircase', 'feature_wall');--> statement-breakpoint
CREATE TABLE "generation_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"space" "space_type" NOT NULL,
	"position" integer NOT NULL,
	"status" "generation_status" DEFAULT 'pending' NOT NULL,
	"master_prompt" text NOT NULL,
	"image_url" text,
	"image_key" text,
	"error_message" text,
	"provider_request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generations" ALTER COLUMN "user_prompt" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "texture_id" uuid;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "texture_name" varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "texture_image_key" text;--> statement-breakpoint
ALTER TABLE "generation_images" ADD CONSTRAINT "generation_images_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_images_generation_id_idx" ON "generation_images" USING btree ("generation_id");--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_texture_id_textures_id_fk" FOREIGN KEY ("texture_id") REFERENCES "public"."textures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" DROP COLUMN "room_image_url";--> statement-breakpoint
ALTER TABLE "generations" DROP COLUMN "generated_image_url";--> statement-breakpoint
ALTER TABLE "generations" DROP COLUMN "master_prompt";--> statement-breakpoint
ALTER TABLE "generations" DROP COLUMN "error_message";