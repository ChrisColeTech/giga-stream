import { Segmented } from "@giga/ui/controls/Segmented";
import { IconButton } from "@giga/ui/controls/IconButton";
import { LIBRARY_COPY, SCOPE_OPTIONS } from "@/lib/library-copy";
import type { Scope } from "@/lib/library-query";
import { RefreshCw, Search } from "lucide-react";

export interface TypeStripProps {
  readonly scope: Scope;
  readonly onScope: (scope: Scope) => void;
  readonly onRefresh?: () => void;
  readonly refreshing?: boolean;
  /** Opens the Search titles spotlight (`06` section 4.6). */
  readonly onSearch?: () => void;
}

/* LoRA Studio's top strip over a gallery grid (components/media/HandoffStrip.tsx `STRIP`). */
const STRIP = "flex flex-none flex-wrap items-center gap-2 border-b border-hair px-3 py-2";

/** The type strip above the grid: All, Movies, TV and Local as the family's pill choice, in the gallery's top strip, with
 *  Refresh and, right beside it, Search titles at its right end. */
export function TypeStrip({ scope, onScope, onRefresh, refreshing = false, onSearch }: TypeStripProps) {
  return (
    <div className={STRIP}>
      <Segmented<Scope> aria-label="Type" equal options={SCOPE_OPTIONS} value={scope} onChange={onScope} />
      <span className="min-w-0 flex-1" aria-hidden />
      {onRefresh !== undefined && (
        <IconButton aria-label="Refresh Library" title="Refresh Library" onClick={onRefresh}>
          <RefreshCw className={refreshing ? "animate-spin" : undefined} aria-hidden />
        </IconButton>
      )}
      {onSearch !== undefined && (
        <IconButton aria-label={LIBRARY_COPY.searchTitles} title={LIBRARY_COPY.searchTitles} onClick={onSearch}>
          <Search aria-hidden />
        </IconButton>
      )}
    </div>
  );
}
