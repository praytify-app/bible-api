/**
 * WCAG 2.x contrast for the custom accent. The widget uses `--pb-accent` for
 * its links and focus ring, so a pale or murky accent can make the links
 * unreadable on the widget's own background. The builder warns rather than
 * blocks: it is the integrator's page and their call.
 */

import { WIDGET_COLOURS, type WidgetTheme } from "./config";

/** Text links need 4.5:1 (WCAG 2.1 AA, 1.4.3). */
export const MIN_LINK_CONTRAST = 4.5;

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** Contrast ratio between two `#rrggbb` colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export interface AccentShortfall {
  background: "light" | "dark";
  ratio: number;
}

/**
 * Widget backgrounds the accent falls short on. "auto" can render either,
 * depending on the visitor's device, so both are checked.
 */
export function accentShortfalls(accent: string, theme: WidgetTheme): AccentShortfall[] {
  const backgrounds: ("light" | "dark")[] = theme === "auto" ? ["light", "dark"] : [theme];
  return backgrounds
    .map((background) => ({ background, ratio: contrastRatio(accent, WIDGET_COLOURS[background].background) }))
    .filter((check) => check.ratio < MIN_LINK_CONTRAST);
}

/** "3.2:1", rounded down so a value never reads as passing when it does not. */
export function formatRatio(ratio: number): string {
  return `${Math.floor(ratio * 10) / 10}:1`;
}
