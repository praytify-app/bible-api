export type ClassValue = string | false | null | undefined | 0;

/**
 * Join class names, skipping falsy values.
 *
 * There is no conflict resolution: a caller's className is appended, but which
 * of two conflicting utilities wins depends on Tailwind's stylesheet order, not
 * on the order here. Prefer a primitive's props over overriding its utilities.
 */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
