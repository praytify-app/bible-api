import { createContext, useContext } from "react";

/** What a Field hands to the control inside it, so label, hint and error stay wired without prop drilling. */
export interface FieldControlContext {
  id: string;
  labelId: string;
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
  disabled?: boolean;
}

export const FieldContext = createContext<FieldControlContext | null>(null);

/** For custom controls placed inside <Field>. Returns null outside one. */
export function useFieldControl(): FieldControlContext | null {
  return useContext(FieldContext);
}

/** Merge describedby ids from the Field and from the control's own props. */
export function joinIds(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(" ");
  return joined || undefined;
}
