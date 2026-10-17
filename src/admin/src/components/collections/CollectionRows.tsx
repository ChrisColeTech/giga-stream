import { Library } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { Wide } from "@giga/ui/form/Wide";
import { SHIMMER, SkeletonRows } from "@/components/ui/SkeletonRows";
import { ArmedButton } from "@/components/ui/ArmedButton";
import { cn } from "@giga/ui/lib/cn";
import { TYPE_LABEL } from "@/lib/collections-copy";
import { LIBRARY_COPY } from "@/lib/library-copy";
import type { CollectionRow } from "@/types/collection";

/* The stored collections, as Sensenova's datasets grid (pages/datasets/DatasetRows.tsx): a header row of column names,
 * then a row per collection that opens it, with Remove (the rail menu's word) beside the row as an inline two-step. Deltas: no tick
 * column (Sensenova's tick picks the app context for a forward verb, and this window has none), and no Refresh on the
 * heading (owner: section headers carry no buttons).
 *
 * The tracks are rem, never ch: a ch track is measured in its own element's font, so the 12px header and the 14px rows
 * would get different widths and the columns would not line up. */
const COLS = "grid grid-cols-[minmax(0,1fr)_6rem_5rem_5rem_6rem] items-center gap-3 px-3";

export interface CollectionRowsProps {
  readonly rows: readonly CollectionRow[];
  readonly onOpen: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export function CollectionRows({ rows, onOpen, onDelete }: CollectionRowsProps) {
  return (
    <Group icon={Library} title="Collections" last>
      <Wide>
        {/* The folders table's header (ui/DataTable): sans 12px semibold, faint, on the panel over a hairline. */}
        <div className={`${COLS} border-b border-hair bg-panel py-1.5 font-sans text-xs font-semibold text-faint`}>
          <span>name</span>
          <span>type</span>
          <span className="text-right">videos</span>
          <span className="text-right">folders</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <SkeletonRows count={4} />
        ) : (
          <ul className="m-0 flex list-none flex-col p-0" aria-label="Collections">
            {rows.map((row) => (
              <li key={row.id} className={`${COLS} rounded-ctl text-sm hover:bg-hov`}>
                <button
                  type="button"
                  className="col-span-4 grid cursor-pointer grid-cols-subgrid items-center border-0 bg-transparent p-0 text-left"
                  onClick={() => onOpen(row.id)}
                >
                  <span className="h-9 truncate leading-9 font-medium text-text">{row.name}</span>
                  <span className="truncate text-muted">{TYPE_LABEL[row.type]}</span>
                  {/* While a scan runs, the count is still arriving: the rail's shimmer pill, the partial count its
                      tooltip, so the index and the rail say "scanning" the same way and no scan column is spent. */}
                  {row.scan === "scanning" ? (
                    <span className="flex justify-end" title={LIBRARY_COPY.scanningSoFar(row.total)}>
                      <span aria-hidden className={cn(SHIMMER, "h-[9px] w-6")} />
                      <span className="sr-only">{LIBRARY_COPY.scanning}</span>
                    </span>
                  ) : (
                    <span className="text-right font-mono text-xs tabular-nums text-muted">{row.total}</span>
                  )}
                  <span className="text-right font-mono text-xs tabular-nums text-muted">{row.folders}</span>
                </button>
                <span className="flex justify-end">
                  <ArmedButton
                    question={`Remove ${row.name}?`}
                    title="Remove the collection; the original files are untouched"
                    onConfirm={() => onDelete(row.id)}
                  >
                    Remove
                  </ArmedButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Wide>
    </Group>
  );
}
