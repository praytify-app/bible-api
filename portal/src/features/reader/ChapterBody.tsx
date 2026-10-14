import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { Alert, cx } from "@/components/ds";
import type { BibleVerse } from "@/lib/api";
import {
  clampRange,
  describeSelection,
  formatReference,
  formatVerseParam,
  inRange,
  nextSelection,
  type VerseRange,
  type VerseSelection,
} from "./selection";
import { SelectionToolbar } from "./SelectionToolbar";
import type { ReaderSettings } from "./settings";
import { buildCopyText, embedHref, shareUrl } from "./share";

export interface ChapterBodyProps {
  verses: readonly BibleVerse[];
  version: string;
  bookCode: string;
  bookName: string;
  chapter: number;
  /** From `?v=`, before it is checked against the verses this chapter has. */
  linkedRange: VerseRange | null;
  settings: ReaderSettings;
  lang?: string;
  dir: "ltr" | "rtl";
  attribution?: string | null;
  attributionUrl?: string | null;
}

/**
 * The verses of one chapter and the selection on them. Mount it with a key per
 * chapter and `?v=`, so a new chapter or a new shared link starts fresh.
 *
 * Each verse number is a toggle button (one tab stop, arrow keys between them),
 * so keyboard and screen reader users can select. The verse text is also
 * clickable for pointers, which gives touch readers a large target.
 */
export function ChapterBody({
  verses,
  version,
  bookCode,
  bookName,
  chapter,
  linkedRange,
  settings,
  lang,
  dir,
  attribution,
  attributionUrl,
}: ChapterBodyProps) {
  const available = useMemo(() => verses.map((v) => v.number), [verses]);
  const linked = useMemo(() => (linkedRange ? clampRange(linkedRange, available) : null), [linkedRange, available]);

  const [selection, setSelection] = useState<VerseSelection | null>(() =>
    linked ? { ...linked, anchor: linked.start } : null,
  );
  const [focusVerse, setFocusVerse] = useState<number | undefined>(() => linked?.start ?? available[0]);
  const [announcement, setAnnouncement] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // A shared link scrolls its verses into view once, after the router has
  // finished its own scroll reset for the navigation.
  useEffect(() => {
    if (!linked) return;
    const frame = window.requestAnimationFrame(() => {
      const target = containerRef.current?.querySelector(`[data-verse="${linked.start}"]`);
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [linked]);

  function focusVerseButton(verse: number | undefined) {
    if (verse === undefined) return;
    containerRef.current?.querySelector<HTMLButtonElement>(`[data-verse-button="${verse}"]`)?.focus();
  }

  function toggle(verse: number, extend: boolean) {
    const next = nextSelection(selection, verse, { extend, available });
    setSelection(next);
    setFocusVerse(verse);
    setAnnouncement(describeSelection(next));
  }

  function clear() {
    setSelection(null);
    setAnnouncement(describeSelection(null));
    // The toolbar that held focus is about to unmount; keep focus in the text.
    focusVerseButton(focusVerse);
  }

  function handleTextClick(event: MouseEvent<HTMLSpanElement>, verse: number) {
    // Dragging to select text for a manual copy should not also toggle the verse.
    if (!event.shiftKey && window.getSelection()?.toString()) return;
    toggle(verse, event.shiftKey);
  }

  // Shift-click would otherwise extend the browser's text selection as well.
  function handleTextMouseDown(event: MouseEvent<HTMLSpanElement>) {
    if (event.shiftKey) event.preventDefault();
  }

  function handleVerseKeyDown(event: KeyboardEvent<HTMLButtonElement>, verse: number) {
    const index = available.indexOf(verse);
    let target: number | undefined;
    if (event.key === "ArrowDown") target = available[Math.min(index + 1, available.length - 1)];
    else if (event.key === "ArrowUp") target = available[Math.max(index - 1, 0)];
    else if (event.key === "Home") target = available[0];
    else if (event.key === "End") target = available[available.length - 1];
    else if ((event.key === "Enter" || event.key === " ") && event.shiftKey) {
      event.preventDefault();
      toggle(verse, true);
      return;
    }
    if (target === undefined) return;
    event.preventDefault();
    setFocusVerse(target);
    focusVerseButton(target);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && selection) {
      event.preventDefault();
      clear();
    }
  }

  const range: VerseRange | null = selection ? { start: selection.start, end: selection.end } : null;

  return (
    <div onKeyDown={handleKeyDown}>
      {linkedRange && !linked && (
        <Alert tone="info" role="none" className="mb-6">
          This link points to {formatReference(bookName, chapter, linkedRange)}, which {version} does not have. The
          whole chapter is shown instead.
        </Alert>
      )}

      <div
        ref={containerRef}
        lang={lang}
        dir={dir}
        className="font-serif text-scripture text-ink"
        style={{ "--reader-scale": settings.scale } as CSSProperties}
      >
        <p>
          {verses.map((v) => {
            const selected = inRange(v.number, range);
            return (
              <span
                key={v.id ?? v.number}
                data-verse={v.number}
                data-selected={selected || undefined}
                onMouseDown={handleTextMouseDown}
                onClick={(event) => handleTextClick(event, v.number)}
                className={cx(
                  "cursor-pointer rounded-[3px] py-0.5 transition-colors duration-150 box-decoration-clone",
                  selected
                    ? "bg-highlight underline decoration-accent-text decoration-1 underline-offset-[0.3em]"
                    : "hover:bg-surface-sunken",
                )}
              >
                <button
                  type="button"
                  data-verse-button={v.number}
                  tabIndex={v.number === focusVerse ? 0 : -1}
                  aria-pressed={selected}
                  aria-label={`Verse ${v.number}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(v.number, event.shiftKey);
                  }}
                  onKeyDown={(event) => handleVerseKeyDown(event, v.number)}
                  onFocus={() => setFocusVerse(v.number)}
                  className={cx(
                    "cursor-pointer rounded-[3px] px-0.5 align-super font-sans text-[0.6em] font-semibold leading-none text-ink-secondary no-underline",
                    !settings.showVerseNumbers && "sr-only focus-visible:not-sr-only",
                  )}
                >
                  {v.number}
                </button>{" "}
                {v.text.trim()}{" "}
              </span>
            );
          })}
        </p>
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {range && (
        <SelectionToolbar
          reference={
            <>
              <bdi lang={lang}>{bookName}</bdi> {chapter}:{formatVerseParam(range)} ({version})
            </>
          }
          copyText={() =>
            buildCopyText({ verses, range, bookName, chapter, version, attribution, attributionUrl })
          }
          shareLink={() => shareUrl(window.location.origin, version, bookCode, chapter, range)}
          embedHref={embedHref(version, bookCode, chapter, range)}
          onClear={clear}
        />
      )}
    </div>
  );
}
