import { useContext, type ReactNode } from "react";
import { Checkbox } from "../controls/Checkbox";
import { cn } from "../lib/cn";
import { GridRowIndexContext, GridShapeContext } from "./record-grid-layout";

export interface RecordGridRowProps {
  /** The row's state word, also its `data-st` (`live`, `preparing`, `disabled`...). The word itself is a cell. */
  readonly state?: string;
  /** A disabled record stays in its list, dimmed to 45%. */
  readonly dimmed?: boolean;
  /** Ticked: the selected fill. */
  readonly ticked?: boolean;
  /** The row's tick, `Select Fixture News`; present when (and only when) the grid has a selection column. */
  readonly tick?: { readonly label: string; readonly onToggle: (ticked: boolean) => void };
  /** A press on the data cells opens the record. The tick and the end action sit outside this button. */
  readonly onOpen: () => void;
  /** The end of the row: the `Delete` `ArmedButton`. */
  readonly end: ReactNode;
  /** The data cells, one element per data track. */
  readonly children: ReactNode;
}

/** One row of a `RecordGrid`: 36px on `rounded-ctl`, a hover fill, a spanning button over the data cells (Enter and Space
 *  open it), the tick before it and the end action after it. */
export function RecordGridRow({ state, dimmed = false, ticked = false, tick, onOpen, end, children }: RecordGridRowProps) {
  const shape = useContext(GridShapeContext);
  const index = useContext(GridRowIndexContext);
  if (shape === null) throw new Error("RecordGridRow belongs inside a RecordGrid");
  return (
    <li
      data-index={index ?? undefined}
      aria-rowindex={index === null ? undefined : index + 1}
      data-st={state}
      data-ticked={ticked ? "" : undefined}
      className={cn(
        "grid h-9 items-center gap-3 rounded-ctl px-3 text-sm hover:bg-hov",
        ticked && "bg-ctl",
        dimmed && "opacity-45",
      )}
      style={{ gridTemplateColumns: shape.columns }}
    >
      {tick !== undefined && <Checkbox checked={ticked} onChange={tick.onToggle} aria-label={tick.label} />}
      <button
        type="button"
        data-primary={index === null ? undefined : ""}
        className="grid cursor-pointer grid-cols-subgrid items-center border-0 bg-transparent p-0 text-left"
        style={{ gridColumn: `${shape.first} / span ${shape.span}` }}
        onClick={onOpen}
      >
        {children}
      </button>
      <span className="flex justify-end">{end}</span>
    </li>
  );
}
