/** One editable row in the origins editor. */
export interface OriginRow {
  id: number;
  value: string;
  /** Show this row's error once the person has left it (or tried to save). */
  touched: boolean;
}

let nextRowId = 1;

export function newOriginRow(value = ""): OriginRow {
  return { id: nextRowId++, value, touched: false };
}

/** Rows for a key's current origins; always at least one (empty) row to type into. */
export function originRows(values: readonly string[]): OriginRow[] {
  return (values.length > 0 ? values : [""]).map((value) => newOriginRow(value));
}
