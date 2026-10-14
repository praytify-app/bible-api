import { useNavigate } from "@tanstack/react-router";
import type { ComponentProps, MouseEvent } from "react";

/**
 * A real anchor that navigates inside the SPA on a plain left click. Used for
 * URLs built as strings (`/embed?ref=…`, `/read/…?v=16`) so they do not depend
 * on another team's route typings, while middle-click and copy-link still work.
 */
export function AppLink({ href, onClick, target, ...props }: ComponentProps<"a"> & { href: string }) {
  const navigate = useNavigate();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || event.button !== 0 || modified || target) return;
    event.preventDefault();
    void navigate({ href });
  }

  return <a href={href} target={target} onClick={handleClick} {...props} />;
}
