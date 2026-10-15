import { useEffect, useRef } from "react";

// Widgets that use the arrow keys themselves: list pickers, menus, tabs, dialogs.
const ARROW_WIDGETS = '[role="listbox"],[role="combobox"],[role="menu"],[role="tablist"],[role="radiogroup"],[role="slider"],[role="dialog"]';

/** True when an arrow key here belongs to the focused control, not to the page. */
export function ownsArrowKeys(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest(ARROW_WIDGETS) !== null;
}

/**
 * Left and right arrows move between chapters, unless a modifier is held, the
 * person is typing, or an open picker or dialog is using the keys.
 */
export function useChapterShortcuts(handlers: { prev?: () => void; next?: () => void }): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (ownsArrowKeys(event.target) || ownsArrowKeys(document.activeElement)) return;
      const go = event.key === "ArrowLeft" ? latest.current.prev : latest.current.next;
      if (!go) return;
      event.preventDefault();
      go();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
