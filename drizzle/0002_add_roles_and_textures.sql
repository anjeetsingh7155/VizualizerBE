CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('sq_ft', 'sq_m', 'piece', 'box');--> statement-breakpoint
CREATE TYPE "public"."texture_category" AS ENUM('granite', 'marble', 'tile', 'wood', 'stone');--> statement-breakpoint
CREATE TABLE "textures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" texture_category NOT NULL,
	"size" varchar(60),
	"finish" varchar(40),
	"price_amount" numeric(10, 2),
	"price_unit" "price_unit" DEFAULT 'sq_ft' NOT NULL,
	"image_url" text NOT NULL,
	"image_key" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"thumbnail_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "textures" ADD CONSTRAINT "textures_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "textures_category_idx" ON "textures" USING btree ("category");--> statement-breakpoint
CREATE INDEX "textures_is_active_idx" ON "textures" USING btree ("is_active");