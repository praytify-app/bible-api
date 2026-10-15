/** The fields every catalog version shape here has. */
interface VersionNaming {
  abbreviation: string;
  name: string;
  code?: string | null;
}

const SHORT_SAFE = /^[A-Za-z0-9-]{1,12}$/;

/**
 * What a version is called in URLs, widget attributes, and API calls: the
 * abbreviation when it is short and URL-safe (`WEB`), otherwise the engine's
 * code (`engwebp`). Imported abbreviations are often full titles, and some
 * contain a slash. The engine accepts either. Same rule as `versionSlug()` in
 * the SDK.
 */
export function versionSlug(version: Pick<VersionNaming, "abbreviation" | "code">): string {
  if (SHORT_SAFE.test(version.abbreviation)) return version.abbreviation;
  return version.code ?? version.abbreviation;
}

/** `WEB · World English Bible`, or just the name when the abbreviation is the title again. */
export function versionLabel(version: Pick<VersionNaming, "abbreviation" | "name">): string {
  return version.abbreviation.trim() === version.name.trim() ? version.name : `${version.abbreviation} · ${version.name}`;
}
