import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { signOut } from "@/lib/auth";

/**
 * Sign out, return to the home page (AUDIT must-not-regress 15), then drop the
 * cached dashboard data so the next account to sign in on this tab never sees
 * the previous one's keys or usage. Only inactive queries are removed: by then
 * the dashboard has unmounted, and the home page's public reads stay cached.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await signOut();
    await navigate({ to: "/" });
    queryClient.removeQueries({ type: "inactive" });
  }, [navigate, queryClient]);
}
