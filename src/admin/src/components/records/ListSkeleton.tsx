import { SHIMMER, SHIMMER_TILE } from "@giga/ui/lib/shimmer";

/* A list's rows while it loads (or is empty): 36px rows with a tick-sized block, then cells of cycling widths, the shape
 * of a grid row. Six of them, as the mockup's. The grid's own skeleton in its header's column set replaces this when the
 * grid lands (Wave 3). */
const CELL_WIDTHS = ["58%", "40%", "72%", "34%", "50%", "64%"];

export function ListSkeleton({ count = 6 }: { readonly count?: number }) {
  return (
    <div className="pointer-events-none flex flex-col" aria-hidden>
      {Array.from({ length: count }, (_, row) => (
        <div key={row} className="flex h-9 items-center gap-4 px-3">
          <span className={`${SHIMMER_TILE} size-5 flex-none rounded-ctl`} />
          {[0, 1, 2].map((cell) => (
            <span
              key={cell}
              className={`${SHIMMER} flex-1`}
              style={{ maxWidth: CELL_WIDTHS[(row + cell * 2) % CELL_WIDTHS.length] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
