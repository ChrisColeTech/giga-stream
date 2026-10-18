import { useContext } from "react";
import { SHIMMER, SHIMMER_TILE } from "../lib/shimmer";
import { GridShapeContext } from "./record-grid-layout";

/* Cell widths cycle so the rows do not read as a table of equal bars. */
const CELL_WIDTHS = ["58%", "40%", "72%", "34%", "50%", "64%"];

/** A list's rows while it loads, or while it is empty: 36px rows in the header's OWN column set (a tick-sized tile where
 *  the tick is, then one shimmer per data track), so the rows land where these stood. No sentence sits over it. Inside a
 *  `RecordGrid`, in place of its rows. */
export function SkeletonGrid({ rows = 6 }: { readonly rows?: number }) {
  const shape = useContext(GridShapeContext);
  if (shape === null) throw new Error("SkeletonGrid belongs inside a RecordGrid");
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <li
          key={row}
          aria-hidden
          className="pointer-events-none grid h-9 items-center gap-3 px-3"
          style={{ gridTemplateColumns: shape.columns }}
        >
          {shape.selectable && <span className={`${SHIMMER_TILE} size-5 rounded-ctl`} />}
          {Array.from({ length: shape.span }, (_, cell) => (
            <span key={cell} className={SHIMMER} style={{ width: CELL_WIDTHS[(row + cell * 2) % CELL_WIDTHS.length] }} />
          ))}
          <span />
        </li>
      ))}
    </>
  );
}
