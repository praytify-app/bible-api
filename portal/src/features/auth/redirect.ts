/** Where a signed-in developer lands when nothing better is known. */
export const DEFAULT_RETURN_PATH = "/dashboard";

/**
 * The only paths sign-in may send someone back to. Anything else (another
 * origin, a protocol-relative `//host`, a backslash trick, a public page)
 * falls back to the dashboard, so `?redirect=` cannot become an open redirect.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_RETURN_PATH;
  if (!/^\/dashboard(?:[/?#]|$)/.test(value)) return DEFAULT_RETURN_PATH;
  if (/[\\\s]/.test(value) || value.includes("//")) return DEFAULT_RETURN_PATH;
  return value;
}

export interface LoginSearch {
  redirect?: string;
}

/** `validateSearch` for the /login route. Unsafe values are dropped, not echoed. */
export function validateLoginSearch(search: Record<string, unknown>): LoginSearch {
  const redirect = safeReturnPath(search.redirect);
  return redirect === DEFAULT_RETURN_PATH ? {} : { redirect };
}
