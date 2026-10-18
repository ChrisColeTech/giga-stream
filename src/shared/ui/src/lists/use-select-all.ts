import { useContext } from "react";
import { SelectAllContext, type SelectAll } from "./select-all-context";

/** The scope's `All`, or null outside one (a grid with no selection column). */
export function useSelectAll(): SelectAll | null {
  return useContext(SelectAllContext);
}
