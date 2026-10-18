import type { ReactNode } from "react";

export interface QueryBarProps {
  /** The `QuerySearch`: the dominant control. */
  readonly search: ReactNode;
  /** The sort and the filters (`SortControl`, `QuerySelect`). */
  readonly children: ReactNode;
}

/** The layout of a list's query row, handed to `TableStrip`'s `query`: the search takes the row's width, the sort and the
 *  filters follow it. Wide (900px of the ROW's own width, a container query, not the window's) it is one line; narrower,
 *  the search takes the whole first line and the rest share the second, so no control is ever left alone on a line of
 *  its own. */
export function QueryBar({ search, children }: QueryBarProps) {
  return (
    <div className="@container w-full min-w-0">
      <div className="flex flex-wrap items-center gap-2 @[900px]:flex-nowrap">
        <div className="flex min-w-[220px] flex-1 basis-full @[900px]:basis-0">{search}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
