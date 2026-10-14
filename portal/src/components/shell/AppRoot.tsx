import { Outlet, useMatches } from "@tanstack/react-router";
import { useDocumentTitle } from "./document-title";

/**
 * Root route component. Titles live on the routes as `staticData.title`; the
 * deepest match wins. A route without one (the reader, which titles itself by
 * chapter) keeps whatever its page sets.
 */
export function AppRoot() {
  const title = useMatches({ select: (matches) => matches[matches.length - 1]?.staticData.title });
  useDocumentTitle(title);
  return <Outlet />;
}
