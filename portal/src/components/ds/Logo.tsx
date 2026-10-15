import { cx } from "./cx";

// Exports from Praytify-brand/Indigo, copied unmodified into public/brand/.
const WORDMARK_LIGHT = "/brand/wordmark-indigo.svg";
const WORDMARK_DARK = "/brand/wordmark-white.svg";
const MARK = "/brand/favicon-indigo-white.svg";
const WORDMARK_RATIO = 604 / 176;

export interface LogoProps {
  /** wordmark: "Praytify" lettering. mark: the circular icon (works on both themes). */
  variant?: "wordmark" | "mark";
  /** Rendered height in px. Width follows the artwork's ratio. */
  height?: number;
  /** Append "Bible" in the brand serif, as real text: the product name. */
  product?: boolean;
  className?: string;
}

/**
 * Light and dark wordmarks are separate approved exports; the brand forbids the
 * indigo wordmark on dark and the white one on light, so the theme picks one.
 */
export function Logo({ variant = "wordmark", height = 28, product = false, className }: LogoProps) {
  if (variant === "mark") {
    return <img src={MARK} alt="Praytify" width={height} height={height} className={cx("shrink-0", className)} />;
  }
  const width = Math.round(height * WORDMARK_RATIO);
  return (
    <span className={cx("inline-flex items-baseline gap-1.5", className)}>
      <img src={WORDMARK_LIGHT} alt="Praytify" width={width} height={height} className="self-center dark:hidden" />
      <img src={WORDMARK_DARK} alt="Praytify" width={width} height={height} className="hidden self-center dark:block" />
      {product && (
        <span className="font-serif font-medium italic leading-none text-ink" style={{ fontSize: Math.round(height * 0.82) }}>
          Bible
        </span>
      )}
    </span>
  );
}
