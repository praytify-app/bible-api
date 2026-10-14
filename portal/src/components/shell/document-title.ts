import { useEffect } from "react";

export const SITE_NAME = "Praytify Bible";

/** `<Page> · Praytify Bible`, the form every page title takes. */
export const pageTitle = (page: string) => `${page} · ${SITE_NAME}`;

/** Set document.title. Undefined leaves it alone, for pages that manage their own (the reader). */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
