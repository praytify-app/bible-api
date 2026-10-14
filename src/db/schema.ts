import {
  pgSchema,
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --- BetterAuth tables (public schema) ---
// These must be exported so the Drizzle adapter can find them.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

// --- Platform schema (custom tables) ---

export const platformSchema = pgSchema("platform");

/**
 * API keys used to authenticate requests to protected Bible API endpoints.
 */
export const apiKeys = platformSchema.table(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: varchar("key_prefix", { length: 32 }).notNull(),
    // "secret" (servers, full access) or "publishable" (browsers, read-only,
    // origin-restricted). See docs/adr/0001-publishable-and-secret-api-keys.md.
    kind: varchar("kind", { length: 20 }).default("secret").notNull(),
    allowedOrigins: text("allowed_origins").array().default(sql`'{}'::text[]`).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revoked: boolean("revoked").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("api_keys_key_hash_uidx").on(table.keyHash),
    index("api_keys_user_id_idx").on(table.userId),
    index("api_keys_key_prefix_idx").on(table.keyPrefix),
  ]
);

/**
 * Tracks individual API requests for billing and analytics.
 */
export const usageLogs = platformSchema.table(
  "usage_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    apiKeyId: text("api_key_id").notNull(),
    userId: text("user_id").notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    path: text("path").notNull(),
    statusCode: integer("status_code").notNull(),
    responseTimeMs: integer("response_time_ms").notNull(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("usage_logs_api_key_id_idx").on(table.apiKeyId),
    index("usage_logs_user_id_idx").on(table.userId),
    index("usage_logs_created_at_idx").on(table.createdAt),
    index("usage_logs_user_id_created_at_idx").on(table.userId, table.createdAt),
  ]
);

/**
 * Pre-aggregated daily usage stats per API key for fast dashboard queries.
 */
export const usageDaily = platformSchema.table(
  "usage_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    apiKeyId: text("api_key_id").notNull(),
    userId: text("user_id").notNull(),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
    requestCount: integer("request_count").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    avgResponseTimeMs: integer("avg_response_time_ms").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("usage_daily_api_key_id_date_uidx").on(
      table.apiKeyId,
      table.date
    ),
    index("usage_daily_user_id_idx").on(table.userId),
  ]
);

/**
 * Extended developer profile information beyond what BetterAuth stores.
 */
export const developerProfiles = platformSchema.table(
  "developer_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().unique(),
    appName: text("app_name"),
    appUrl: text("app_url"),
    description: text("description"),
    tier: varchar("tier", { length: 20 }).default("free").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("developer_profiles_user_id_idx").on(table.userId)]
);
