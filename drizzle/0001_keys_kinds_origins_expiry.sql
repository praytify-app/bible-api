ALTER TABLE "platform"."api_keys" ADD COLUMN IF NOT EXISTS "kind" varchar(20) DEFAULT 'secret' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."api_keys" ADD COLUMN IF NOT EXISTS "allowed_origins" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "platform"."api_keys" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_logs_user_id_created_at_idx" ON "platform"."usage_logs" USING btree ("user_id","created_at");