import { Hono } from "hono";
import { z } from "zod";
import { client } from "../db/client.js";
import { apiError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import type { DashboardEnv } from "../lib/session.js";
import { requireSession } from "../lib/session.js";

// Raw request logs are kept 90 days. An internal-tier account can have
// millions, so the export carries the most recent ones plus the daily
// rollups, which cover the whole history.
const EXPORT_LOG_LIMIT = 50_000;

const deleteSchema = z.object({ confirmEmail: z.string().trim().min(1) });

export interface AccountRouterOptions {
  /** Called with every key id the deletion revoked, so cached lookups stop working now. */
  onKeysRemoved: (keyIds: string[]) => void;
}

/**
 * Data-subject rights for developer accounts: a complete export (access and
 * portability) and erasure. Both act only on the signed-in user's own rows.
 */
export function accountRouter(opts: AccountRouterOptions) {
  const router = new Hono<DashboardEnv>();
  router.use("*", requireSession);

  router.get("/export", async (c) => {
    const user = c.get("user");
    const [[profileUser], accounts, sessions, [profile], keys, daily, logs] = await Promise.all([
      client`SELECT id, name, email, email_verified, image, created_at, updated_at FROM "user" WHERE id = ${user.id}`,
      // Provider tokens are deliberately excluded: they are credentials, not personal data to hand out.
      client`SELECT provider_id, account_id, scope, created_at, updated_at FROM account WHERE user_id = ${user.id}`,
      client`SELECT created_at, updated_at, expires_at, ip_address, user_agent FROM session WHERE user_id = ${user.id}`,
      client`SELECT app_name, app_url, description, tier, created_at, updated_at FROM platform.developer_profiles WHERE user_id = ${user.id}`,
      // Key hashes are excluded; the prefix identifies each key.
      client`SELECT id, name, kind, key_prefix, allowed_origins, revoked, created_at, last_used_at, expires_at
             FROM platform.api_keys WHERE user_id = ${user.id} ORDER BY created_at`,
      client`SELECT api_key_id, date, request_count, error_count, avg_response_time_ms
             FROM platform.usage_daily WHERE user_id = ${user.id} ORDER BY date`,
      client`SELECT api_key_id, method, path, status_code, response_time_ms, user_agent, ip_address, created_at
             FROM platform.usage_logs WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT ${EXPORT_LOG_LIMIT}`,
    ]);

    const body = {
      exportedAt: new Date().toISOString(),
      notes: [
        "Provider access and refresh tokens and API key hashes are credentials and are not included.",
        `Raw request logs are kept for 90 days; this export includes up to the ${EXPORT_LOG_LIMIT.toLocaleString("en-US")} most recent. Daily totals cover the full history.`,
      ],
      user: profileUser ?? null,
      linkedAccounts: accounts,
      sessions,
      developerProfile: profile ?? null,
      apiKeys: keys,
      usageDaily: daily,
      usageLogs: logs,
    };
    return c.json(body, 200, {
      "content-disposition": `attachment; filename="praytify-bible-account-${new Date().toISOString().slice(0, 10)}.json"`,
    });
  });

  /**
   * Erase the account and everything tied to it. The caller retypes their
   * email so a stolen session cannot delete an account with one request
   * forged from another tab.
   */
  router.delete("/", async (c) => {
    const user = c.get("user");
    const parsed = deleteSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success || parsed.data.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      return apiError(c, 400, "CONFIRMATION_MISMATCH", "Type your account email exactly to confirm deletion.");
    }

    const removedKeyIds = await client.begin(async (tx) => {
      const keys = await tx<{ id: string }[]>`DELETE FROM platform.api_keys WHERE user_id = ${user.id} RETURNING id`;
      await tx`DELETE FROM platform.usage_logs WHERE user_id = ${user.id}`;
      await tx`DELETE FROM platform.usage_daily WHERE user_id = ${user.id}`;
      await tx`DELETE FROM platform.developer_profiles WHERE user_id = ${user.id}`;
      // Explicit even though the schema cascades: production's tables were
      // built by hand and may lack the foreign keys.
      await tx`DELETE FROM session WHERE user_id = ${user.id}`;
      await tx`DELETE FROM account WHERE user_id = ${user.id}`;
      await tx`DELETE FROM verification WHERE identifier = ${user.email}`;
      await tx`DELETE FROM "user" WHERE id = ${user.id}`;
      return keys.map((k) => k.id);
    });

    opts.onKeysRemoved(removedKeyIds);
    log.info("account deleted", { keysRemoved: removedKeyIds.length });
    return c.json({ deleted: true });
  });

  return router;
}
