import { Segmented } from "@giga/ui/controls/Segmented";
import { IconButton } from "@giga/ui/controls/IconButton";
import { SCOPE_OPTIONS } from "@/lib/library-copy";
import type { Scope } from "@/lib/library-query";
import { RefreshCw } from "lucide-react";

export interface TypeStripProps {
  readonly scope: Scope;
  readonly onScope: (scope: Scope) => void;
  readonly onRefresh?: () => void;
  readonly refreshing?: boolean;
}

/* LoRA Studio's top strip over a gallery grid (components/media/HandoffStrip.tsx `STRIP`). */
const STRIP = "flex flex-none flex-wrap items-center gap-2 border-b border-hair px-3 py-2";

/** The type strip above the grid: All, Movies, TV and Local as the family's pill choice, in the gallery's top strip. */
export function TypeStrip({ scope, onScope, onRefresh, refreshing = false }: TypeStripProps) {
  return (
    <div className={STRIP}>
      <Segmented<Scope> aria-label="Type" equal options={SCOPE_OPTIONS} value={scope} onChange={onScope} />
      {onRefresh !== undefined && (
        <IconButton className="ml-auto" aria-label="Refresh Library" title="Refresh Library" onClick={onRefresh}>
          <RefreshCw className={refreshing ? "animate-spin" : undefined} aria-hidden />
        </IconButton>
      )}
    </div>
  );
}
