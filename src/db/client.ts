import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

const cfg = config();

// postgres() connects lazily, so without DATABASE_URL the module still imports
// (tests, tooling) and fails only on first query. The server entry point
// refuses to boot without it.
const client = postgres(cfg.DATABASE_URL ?? "postgres://unset@127.0.0.1:1/unset", {
  max: cfg.DB_POOL_MAX,
  idle_timeout: 30,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
  // A runaway query is cut off by the server instead of holding a pooled
  // connection until every request queues behind it.
  connection: {
    statement_timeout: cfg.DB_STATEMENT_TIMEOUT_MS,
    application_name: "praytify-bible-gateway",
  },
  onnotice: () => {},
});

export const db = drizzle(client, { schema });

export { client };
