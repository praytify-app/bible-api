import { createContext, useContext } from "react";

/** True when the Table stacks rows into cards below md and must restate table roles. */
export const TableStackContext = createContext(false);

export function useTableStacked() {
  return useContext(TableStackContext);
}
