import {
  pgSchema,
  uuid,
  text,
  timestamp,
  integer,
  index,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";

export const platformSchema = pgSchema("platform");

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
    index("usage_daily_api_key_id_date_idx").on(table.apiKeyId, table.date),
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
