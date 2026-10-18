import { SHIMMER, SHIMMER_TILE } from "../lib/shimmer";

/* Cell widths cycle so the rows do not read as a table of equal bars. */
const CELL_WIDTHS = ["58%", "40%", "72%", "34%", "50%", "64%"];

/** One shimmer row on the table's own `--cols`: a tick-sized tile where the tick is, one shimmer per visible column, an
 *  empty end. A table with nothing read yet draws a few; a paged table draws one for each unloaded row. `seed` varies the
 *  widths. Hidden from assistive technology; no sentence. */
export function RecordTableSkeletonRow({ cells, ticks, seed = 0 }: { readonly cells: number; readonly ticks: boolean; readonly seed?: number }) {
  return (
    <li
      aria-hidden
      className="pointer-events-none grid h-9 items-center gap-3 px-3"
      style={{ gridTemplateColumns: "var(--cols)" }}
    >
      {ticks && <span className={`${SHIMMER_TILE} size-5 rounded-ctl`} />}
      {Array.from({ length: cells }, (_, cell) => (
        <span key={cell} className={SHIMMER} style={{ width: CELL_WIDTHS[(seed + cell * 2) % CELL_WIDTHS.length] }} />
      ))}
      <span />
    </li>
  );
}
