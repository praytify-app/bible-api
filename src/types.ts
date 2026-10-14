import type { KeyKind } from "./lib/api-keys.js";
import type { Tier } from "./plans.js";

/** Who is calling. Set by the API key middleware on every /v1 request. */
export type AuthContext =
  | { type: "anonymous"; ip: string | null }
  | { type: "master"; ip: string | null }
  | { type: "key"; ip: string | null; keyId: string; userId: string; kind: KeyKind; tier: Tier };

export interface GatewayEnv {
  Variables: {
    auth: AuthContext;
    requestId: string;
    cacheStatus?: "HIT" | "MISS" | "BYPASS" | "STALE";
  };
}
