import { Segmented } from "@/components/ui/Segmented";
import { SCOPE_OPTIONS } from "@/lib/library-copy";
import type { Scope } from "@/lib/library-query";

export interface TypeStripProps {
  readonly scope: Scope;
  readonly onScope: (scope: Scope) => void;
}

/* LoRA Studio's top strip over a gallery grid (components/media/HandoffStrip.tsx `STRIP`). */
const STRIP = "flex flex-none flex-wrap items-center gap-2 border-b border-hair px-3 py-2";

/** The type strip above the grid: All, Movies, TV and Local as the family's pill choice, in the gallery's top strip. */
export function TypeStrip({ scope, onScope }: TypeStripProps) {
  return (
    <div className={STRIP}>
      <Segmented<Scope> aria-label="Type" equal options={SCOPE_OPTIONS} value={scope} onChange={onScope} />
    </div>
  );
}
