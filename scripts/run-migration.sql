CREATE SCHEMA IF NOT EXISTS "platform";

CREATE TABLE IF NOT EXISTS public."user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS public."account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL,
  CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS public."verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platform"."api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "key_hash" text NOT NULL,
  "key_prefix" varchar(32) NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platform"."developer_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "app_name" text,
  "app_url" text,
  "description" text,
  "tier" varchar(20) DEFAULT 'free' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "developer_profiles_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "platform"."usage_daily" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "api_key_id" text NOT NULL,
  "user_id" text NOT NULL,
  "date" varchar(10) NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "error_count" integer DEFAULT 0 NOT NULL,
  "avg_response_time_ms" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platform"."usage_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "api_key_id" text NOT NULL,
  "user_id" text NOT NULL,
  "method" varchar(10) NOT NULL,
  "path" text NOT NULL,
  "status_code" integer NOT NULL,
  "response_time_ms" integer NOT NULL,
  "user_agent" text,
  "ip_address" varchar(45),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES public."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "platform"."api_keys" ADD CONSTRAINT "api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES public."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE public."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES public."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "account_userId_idx" ON public."account" USING btree ("user_id");
CREATE UNIQUE INDEX "api_keys_key_hash_uidx" ON "platform"."api_keys" USING btree ("key_hash");
CREATE INDEX "api_keys_user_id_idx" ON "platform"."api_keys" USING btree ("user_id");
CREATE INDEX "api_keys_key_prefix_idx" ON "platform"."api_keys" USING btree ("key_prefix");
CREATE INDEX "developer_profiles_user_id_idx" ON "platform"."developer_profiles" USING btree ("user_id");
CREATE INDEX "session_userId_idx" ON public."session" USING btree ("user_id");
CREATE UNIQUE INDEX "usage_daily_api_key_id_date_uidx" ON "platform"."usage_daily" USING btree ("api_key_id","date");
CREATE INDEX "usage_daily_user_id_idx" ON "platform"."usage_daily" USING btree ("user_id");
CREATE INDEX "usage_logs_api_key_id_idx" ON "platform"."usage_logs" USING btree ("api_key_id");
CREATE INDEX "usage_logs_user_id_idx" ON "platform"."usage_logs" USING btree ("user_id");
CREATE INDEX "usage_logs_created_at_idx" ON "platform"."usage_logs" USING btree ("created_at");
CREATE INDEX "verification_identifier_idx" ON public."verification" USING btree ("identifier");

INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('0000_overrated_vision', extract(epoch from now())::bigint * 1000);
