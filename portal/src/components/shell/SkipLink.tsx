/** Target id for the skip link. Each shell puts it on its <main>. */
export const MAIN_ID = "main";

/** First focusable element in every shell: hidden until a keyboard user tabs to it. */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-pill focus:bg-surface-raised focus:px-4 focus:py-2.5 focus:text-body-sm focus:font-semibold focus:text-ink focus:shadow-overlay"
    >
      Skip to main content
    </a>
  );
}
