import type { Version } from "./types.js";

const SHORT_SAFE = /^[A-Za-z0-9-]{1,12}$/;

/**
 * The identifier to put in URLs and API calls for a version: its abbreviation
 * when that is short and URL-safe (`WEB`, `KJV`), otherwise its code
 * (`engwebp`). Imported abbreviations are often full titles with spaces, and
 * some contain a slash, which no URL path can carry. Falls back to the
 * abbreviation for versions without a code.
 */
export function versionSlug(version: Pick<Version, "abbreviation" | "code">): string {
  if (SHORT_SAFE.test(version.abbreviation)) return version.abbreviation;
  return version.code ?? version.abbreviation;
}
