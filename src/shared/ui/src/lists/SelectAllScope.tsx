import type { ReactNode } from "react";
import { SelectAllContext, type SelectAll } from "./select-all-context";

export type { SelectAll } from "./select-all-context";

/** Gives the grids below it their header `All`: a list's strip and its grid are siblings, so the list states the
 *  selection once, here, and the grid's header reads it. */
export function SelectAllScope({ all, children }: { readonly all: SelectAll; readonly children: ReactNode }) {
  return <SelectAllContext value={all}>{children}</SelectAllContext>;
}
