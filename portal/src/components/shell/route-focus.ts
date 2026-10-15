import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MAIN_ID } from "./SkipLink";

/** Longest wait for the new page's heading and first data before falling back to <main>. */
const SETTLE_TIMEOUT_MS = 5000;

/**
 * Client-side navigation is silent to screen readers: the title changes but
 * nothing is read, and focus stays on the link that was clicked. After each
 * navigation to a new path, once the new page has settled (an h1 in <main>,
 * no `aria-busy` left, no dialog mounted), this moves focus to that h1 so the
 * heading is read.
 *
 * When focus is still on a control inside the page, it stays: the reader's
 * chapter buttons survive the navigation, and yanking focus off them would
 * break paging through a book from the keyboard. The heading is announced
 * through the returned live-region message instead.
 *
 * Keyed on the resolved location, not the pending one: the router updates the
 * location before the new route's lazy component and loaders finish, and the
 * old page's heading would still be on screen.
 */
export function useRouteFocus(): string {
  const pathname = useRouterState({ select: (s) => s.resolvedLocation?.pathname });
  const shown = useRef(pathname);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // The first page to resolve is not a navigation; neither is React's
    // development re-run of this effect.
    const previous = shown.current;
    shown.current = pathname;
    if (!pathname || !previous || previous === pathname) return;

    let frame = 0;
    const started = performance.now();
    const settle = () => {
      const main = document.getElementById(MAIN_ID);
      const heading = main?.querySelector("h1");
      // A closing dialog (the phone menu sheet) hands focus back to its
      // trigger when it unmounts, after its exit animation; wait it out.
      const ready = heading && !main?.querySelector('[aria-busy="true"]') && !document.querySelector('[role="dialog"]');
      if (!ready && performance.now() - started < SETTLE_TIMEOUT_MS) {
        frame = requestAnimationFrame(settle);
        return;
      }
      if (!main) return;
      const active = document.activeElement;
      if (active && active !== main && active !== heading && main.contains(active)) {
        setMessage(heading?.textContent?.trim() || document.title);
        return;
      }
      if (heading && !heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      (heading ?? main).focus({ preventScroll: true });
    };
    frame = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return message;
}
