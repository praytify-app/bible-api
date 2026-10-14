// Class recipes shared by several primitives, kept in one place so inputs,
// selects and pickers stay the same height, radius and state colours.

/** Text inputs, select triggers, picker triggers. 44px tall; 16px text so iOS does not zoom on focus. */
export const controlBase =
  "w-full min-h-11 rounded-input border border-control bg-surface-raised px-3.5 text-body text-ink " +
  "placeholder:text-ink-muted transition-colors duration-150 " +
  "enabled:hover:border-ink-secondary aria-[invalid=true]:border-danger " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted";

/** Floating surfaces: select lists, dropdown menus, popovers. */
export const overlaySurface =
  "z-50 rounded-card border border-hairline bg-surface-overlay text-ink shadow-overlay " +
  "data-[state=open]:animate-pop-in data-[state=closed]:animate-fade-out";

/** Rows inside select lists and menus. Highlight changes text colour too, so it never relies on a faint tint alone. */
export const menuItem =
  "relative flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-3 text-body-sm text-ink " +
  "outline-none sm:min-h-10 data-[highlighted]:bg-accent-subtle data-[highlighted]:text-accent-text " +
  "data-[disabled]:pointer-events-none data-[disabled]:text-ink-muted [&_svg]:size-4 [&_svg]:shrink-0";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";

/** Shared by Button and IconButton so both read as one family. */
export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "rounded-pill bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active",
  secondary:
    "rounded-pill border border-border bg-surface-raised text-ink hover:bg-surface-sunken active:bg-surface-sunken",
  ghost: "rounded-pill text-ink-secondary hover:bg-surface-sunken hover:text-ink active:bg-surface-sunken",
  danger: "rounded-pill bg-danger-fill text-on-danger hover:bg-danger-hover",
  link: "gap-1.5 rounded-[4px] text-accent-text underline-offset-4 hover:underline [&_svg]:size-4",
};

