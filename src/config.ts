import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", "yes", "no"])
  .transform((v) => v === "true" || v === "1" || v === "yes");

const csv = z
  .string()
  .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3200),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),

  // Optional at load so the app module can be imported by tests without a
  // database. The server entry point refuses to start without it.
  DATABASE_URL: z.string().min(1).optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(200).default(10),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(15_000),
  MIGRATE_ON_BOOT: bool.default(false),

  BIBLE_API_URL: z.url().default("http://localhost:3100"),
  // Shared secret the engine uses to recognise gateway traffic and skip its
  // own per-IP limiter, so every user behind the gateway is not one "IP".
  GATEWAY_TOKEN: z.string().min(16).optional(),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).default(15_000),
  DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().min(1000).default(120_000),

  PUBLIC_API_URL: z.url().optional(),
  PORTAL_URL: csv.default(["http://localhost:5173"]),
  BETTER_AUTH_URL: z.url().default("http://localhost:3200"),
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Deprecated: first-party apps should use an internal-tier secret key.
  MASTER_API_KEY: z.string().min(24).optional(),

  // Number of reverse proxies in front of the gateway that append to
  // X-Forwarded-For (Traefik in production is 1). 0 means trust only the socket.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  REDIS_URL: z.string().optional(),
  ANON_RATE_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  ANON_RATE_PER_DAY: z.coerce.number().int().min(1).default(20_000),
  MAX_KEYS_PER_USER: z.coerce.number().int().min(1).max(500).default(20),
  KEY_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(3600).default(60),

  READ_CACHE_MAX_MB: z.coerce.number().min(0).max(4096).default(128),
  READ_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(3600),
  READ_CACHE_MAX_ENTRY_KB: z.coerce.number().int().min(1).default(1024),

  RUN_JOBS: bool.default(true),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // Treat empty strings as unset: compose files commonly render `${VAR:-}`.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid gateway configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Checks that only matter for a real deployment, kept out of loadConfig so tests stay light. */
export function assertProductionReady(cfg: Config): void {
  const problems: string[] = [];
  if (!cfg.DATABASE_URL) problems.push("DATABASE_URL is required");
  if (cfg.NODE_ENV === "production") {
    if (!cfg.BETTER_AUTH_SECRET || cfg.BETTER_AUTH_SECRET.length < 32) {
      problems.push("BETTER_AUTH_SECRET must be at least 32 characters in production");
    }
    if (!cfg.GATEWAY_TOKEN) problems.push("GATEWAY_TOKEN is required in production");
  }
  if (problems.length) throw new Error(`Refusing to start:\n  ${problems.join("\n  ")}`);
}

let cached: Config | undefined;

export function config(): Config {
  cached ??= loadConfig();
  return cached;
}

/** Test hook: replace the process-wide config. */
export function setConfig(next: Config): void {
  cached = next;
}
