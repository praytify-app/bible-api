import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keys, plan, usage, type ApiKey, type CreateKeyInput } from "@/lib/api";

// ["keys"] and ["usage-summary"] are shared with the dashboard overview, so a
// change made here shows there without a reload.
export const KEYS_QUERY = ["keys"] as const;
export const PLAN_QUERY = ["plan"] as const;
export const USAGE_DAYS = 30;
export const KEY_USAGE_QUERY = ["usage-keys", USAGE_DAYS] as const;

/** Key metadata. Never carries the full key: that exists only in the reveal panel's state. */
export type KeyMeta = Omit<ApiKey, "key">;

/** The one-time secret from a create or roll, held by the page until it is dismissed. */
export interface Revealed {
  meta: KeyMeta;
  secret: string;
  reason: "created" | "rolled";
  /** Prefix of the key a roll replaced. */
  replacedPrefix?: string;
}

export function useKeys() {
  return useQuery({ queryKey: KEYS_QUERY, queryFn: keys.list });
}

export function usePlan() {
  return useQuery({ queryKey: PLAN_QUERY, queryFn: plan.get, staleTime: 5 * 60_000 });
}

export function useKeyUsage() {
  return useQuery({ queryKey: KEY_USAGE_QUERY, queryFn: () => usage.byKey(USAGE_DAYS) });
}

/**
 * Split the plaintext key off a create or roll response before TanStack Query
 * sees it. A mutation's resolved value is kept in the MutationCache (visible in
 * devtools, kept after unmount until gcTime), so the mutationFn hands the secret
 * straight to the caller and returns metadata only. AUDIT must-not-regress 4.
 */
function takeSecret(key: ApiKey): { meta: KeyMeta; secret: string } {
  const { key: secret, ...meta } = key;
  if (!secret) throw new Error("The server did not return the new key. Roll the key to get a fresh one.");
  return { meta, secret };
}

function useInvalidateKeys() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: KEYS_QUERY });
    // Active key count on the overview.
    void client.invalidateQueries({ queryKey: ["usage-summary"] });
  };
}

export function useCreateKey(onSecret: (revealed: Revealed) => void) {
  const invalidate = useInvalidateKeys();
  return useMutation({
    mutationFn: async (input: CreateKeyInput) => {
      const { meta, secret } = takeSecret(await keys.create(input));
      onSecret({ meta, secret, reason: "created" });
      return meta;
    },
    gcTime: 0,
    onSettled: invalidate,
  });
}

export function useRollKey(onSecret: (revealed: Revealed) => void) {
  const invalidate = useInvalidateKeys();
  return useMutation({
    mutationFn: async (old: KeyMeta) => {
      const result = await keys.roll(old.id);
      const { meta, secret } = takeSecret(result.key);
      onSecret({ meta, secret, reason: "rolled", replacedPrefix: old.prefix });
      return meta;
    },
    gcTime: 0,
    onSettled: invalidate,
  });
}

export function useUpdateKey() {
  const invalidate = useInvalidateKeys();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; allowedOrigins?: string[] } }) =>
      keys.update(id, patch),
    onSettled: invalidate,
  });
}

export function useRevokeKey() {
  const invalidate = useInvalidateKeys();
  return useMutation({
    mutationFn: (id: string) => keys.revoke(id),
    onSettled: invalidate,
  });
}
