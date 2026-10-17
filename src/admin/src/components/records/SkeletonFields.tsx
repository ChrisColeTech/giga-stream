import { SHIMMER, SHIMMER_TILE } from "@giga/ui/lib/shimmer";

/* A form row's footprint while its fields are not there yet: the label column and a 36px control, in the form's own
 * row gap, so the rows land where they were. No sentence ever sits over a skeleton. */
const LABEL_WIDTHS = ["52%", "38%", "60%", "44%", "56%"];

export function SkeletonFields({ count }: { readonly count: number }) {
  return (
    <div className="pointer-events-none flex flex-col gap-3" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="flex w-[var(--label-col,140px)] flex-none items-center">
            <span className={SHIMMER} style={{ width: LABEL_WIDTHS[index % LABEL_WIDTHS.length] }} />
          </span>
          <span className={`${SHIMMER_TILE} h-9 min-w-0 flex-1 rounded-ctl`} />
        </div>
      ))}
    </div>
  );
}
