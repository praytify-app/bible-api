import { Code, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button, CopyButton, IconButton } from "@/components/ds";
import { AppLink } from "./AppLink";

export interface SelectionToolbarProps {
  /** Pass the book name inside <bdi> so an RTL name does not reorder "3:16-18". */
  reference: ReactNode;
  /** Read at click time so the copy always matches the current selection. */
  copyText: () => string;
  shareLink: () => string;
  embedHref: string;
  onClear: () => void;
}

/** Sticks to the bottom of the viewport while the chapter is on screen. */
export function SelectionToolbar({ reference, copyText, shareLink, embedHref, onClear }: SelectionToolbarProps) {
  return (
    <div role="region" aria-label="Selected verses" className="sticky bottom-3 z-30 mt-8" dir="ltr">
      {/* Phones: reference and Clear on the first line, actions under them; from sm, one line.
          Clear is last in DOM order (like Dialog's Close), so focus order matches the desktop layout. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-panel border border-border bg-surface-overlay py-2 pl-4 pr-2 shadow-overlay">
        <p className="min-w-0 flex-1 truncate font-sans text-body-sm font-semibold text-ink">{reference}</p>
        <div className="order-last flex w-full flex-wrap items-center gap-1.5 sm:order-none sm:w-auto">
          <CopyButton value={copyText} label="Copy" />
          <CopyButton value={shareLink} label="Copy link" />
          <Button asChild variant="secondary" size="sm" leadingIcon={<Code aria-hidden />}>
            <AppLink href={embedHref}>Embed</AppLink>
          </Button>
        </div>
        <IconButton label="Clear selection" icon={<X />} size="sm" onClick={onClear} />
      </div>
    </div>
  );
}
