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
  // Email and password sign-in. Off by default for the hosted service; on for
  // self-hosters who do not want to register OAuth apps.
  EMAIL_PASSWORD_AUTH: bool.default(false),

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

// docker-compose.yml falls back to `*-change-me` values so `docker compose up`
// works on a laptop with no .env. They are public, so they must never sign
// sessions or guard the engine on a gateway other people can reach.
const PLACEHOLDER = /change-me/i;

/** True when the URL names this machine, so only local browsers can use the gateway. */
export function isLoopbackUrl(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "[::1]";
}

function servedPublicly(cfg: Config): boolean {
  return [cfg.BETTER_AUTH_URL, cfg.PUBLIC_API_URL].some((url) => url !== undefined && !isLoopbackUrl(url));
}

/** Secrets still on their compose placeholder. Each is changed in .env alone, so refusing costs one edit. */
function placeholderSecrets(cfg: Config): string[] {
  const out: string[] = [];
  if (cfg.BETTER_AUTH_SECRET && PLACEHOLDER.test(cfg.BETTER_AUTH_SECRET)) out.push("BETTER_AUTH_SECRET");
  if (cfg.GATEWAY_TOKEN && PLACEHOLDER.test(cfg.GATEWAY_TOKEN)) out.push("GATEWAY_TOKEN");
  return out;
}

/**
 * A placeholder database password only warns: Postgres is never published by
 * the compose file, and changing an initialized role's password takes an
 * ALTER ROLE, not just an .env edit.
 */
function placeholderDatabasePassword(cfg: Config): boolean {
  if (!cfg.DATABASE_URL) return false;
  try {
    return PLACEHOLDER.test(decodeURIComponent(new URL(cfg.DATABASE_URL).password));
  } catch {
    return false;
  }
}

/** Checks that only matter for a real deployment, kept out of loadConfig so tests stay light. */
export function assertProductionReady(cfg: Config): void {
  const problems: string[] = [];
  if (!cfg.DATABASE_URL) problems.push("DATABASE_URL is required");
  if (cfg.NODE_ENV === "production") {
    if (!cfg.BETTER_AUTH_SECRET || cfg.BETTER_AUTH_SECRET.length < 32) {
      problems.push("BETTER_AUTH_SECRET must be at least 32 characters in production");
    }
  }
  const placeholders = placeholderSecrets(cfg);
  if (placeholders.length && servedPublicly(cfg)) {
    problems.push(
      `${placeholders.join(" and ")} still ${placeholders.length > 1 ? "use their" : "uses its"} public docker-compose.yml placeholder, ` +
        "but the gateway is served beyond localhost. Set real values in .env (openssl rand -hex 32)",
    );
  }
  if (problems.length) throw new Error(`Refusing to start:\n  ${problems.join("\n  ")}`);
}

/** Settings that work but deserve a loud note at boot. */
export function configWarnings(cfg: Config): string[] {
  const out: string[] = [];
  if (cfg.NODE_ENV === "production" && !cfg.GATEWAY_TOKEN) {
    out.push("GATEWAY_TOKEN is unset: the engine will apply its own per-IP limit on top of the gateway's");
  }
  if (cfg.MASTER_API_KEY) {
    out.push("MASTER_API_KEY is deprecated: give first-party apps an internal-tier secret key instead");
  }
  if (cfg.NODE_ENV === "production" && cfg.TRUST_PROXY_HOPS === 0) {
    out.push("TRUST_PROXY_HOPS=0 in production: behind Traefik every client shares the proxy's IP for rate limiting");
  }
  const placeholders = placeholderSecrets(cfg);
  if (placeholders.length && !servedPublicly(cfg)) {
    out.push(`${placeholders.join(" and ")} use public placeholders: fine on this machine, change them before exposing the gateway`);
  }
  if (placeholderDatabasePassword(cfg)) {
    out.push("the DATABASE_URL password is a public placeholder: keep Postgres unpublished, or set real passwords before first boot");
  }
  if (!cfg.EMAIL_PASSWORD_AUTH && !(cfg.GITHUB_CLIENT_ID && cfg.GITHUB_CLIENT_SECRET) && !(cfg.GOOGLE_CLIENT_ID && cfg.GOOGLE_CLIENT_SECRET)) {
    out.push("no sign-in method is configured: set GitHub or Google OAuth credentials, or EMAIL_PASSWORD_AUTH=true");
  }
  return out;
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
