import { useContext } from "react";
import { SHIMMER, SHIMMER_TILE } from "../lib/shimmer";
import { GridShapeContext } from "./record-grid-layout";

/* Cell widths cycle so the rows do not read as a table of equal bars. */
const CELL_WIDTHS = ["58%", "40%", "72%", "34%", "50%", "64%"];

/** One shimmer row in the header's OWN column set (a tick-sized tile where the tick is, then one shimmer per data
 *  track): a row of `SkeletonGrid`, and, in a windowed grid, a row whose page is not loaded yet, drawn in place so the
 *  row lands where it stood (`docs/41` section 4.2). `seed` varies the cell widths. Hidden from assistive technology. */
export function RecordGridSkeletonRow({ seed = 0 }: { readonly seed?: number }) {
  const shape = useContext(GridShapeContext);
  if (shape === null) throw new Error("RecordGridSkeletonRow belongs inside a RecordGrid");
  return (
    <li
      aria-hidden
      className="pointer-events-none grid h-9 items-center gap-3 px-3"
      style={{ gridTemplateColumns: shape.columns }}
    >
      {shape.selectable && <span className={`${SHIMMER_TILE} size-5 rounded-ctl`} />}
      {Array.from({ length: shape.span }, (_, cell) => (
        <span key={cell} className={SHIMMER} style={{ width: CELL_WIDTHS[(seed + cell * 2) % CELL_WIDTHS.length] }} />
      ))}
      <span />
    </li>
  );
}
