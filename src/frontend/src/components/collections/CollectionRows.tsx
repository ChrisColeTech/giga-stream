import { Library, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Group, Wide } from "@/components/ui/Form";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { TwoStep } from "@/components/ui/TwoStep";
import { SCAN_LABEL } from "@/lib/collections-copy";
import type { CollectionRow } from "@/types/collection";

/* The stored collections, as Sensenova's datasets grid (pages/datasets/DatasetRows.tsx): a header row of column names,
 * then a row per collection that opens it, with Delete beside the row it removes as an inline two-step. Refresh acts on
 * this list, so it sits on the heading. Delta: no tick column; Sensenova's tick picks the app context for a forward
 * verb, and the Collections window has no forward verb. */
const COLS = "grid grid-cols-[minmax(0,2fr)_7ch_7ch_7ch_12ch_auto] items-center gap-3 px-3";

export interface CollectionRowsProps {
  readonly rows: readonly CollectionRow[];
  readonly onRefresh: () => void;
  readonly onOpen: (id: string) => void;
  readonly onDelete: (id: string) => void;
}

export function CollectionRows({ rows, onRefresh, onOpen, onDelete }: CollectionRowsProps) {
  return (
    <Group
      icon={Library}
      title="Collections"
      last
      action={
        <Button size="sm" title="Re-read the collections" onClick={onRefresh}>
          <RefreshCw aria-hidden /> Refresh
        </Button>
      }
    >
      <Wide>
        <div className={`${COLS} font-mono text-xs text-dim`}>
          <span>name</span>
          <span className="text-right">items</span>
          <span className="text-right">manual</span>
          <span className="text-right">folders</span>
          <span>scan</span>
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
                  className="col-span-5 grid cursor-pointer grid-cols-subgrid items-center gap-3 border-0 bg-transparent p-0 text-left"
                  onClick={() => onOpen(row.id)}
                >
                  <span className="h-9 truncate leading-9 font-medium text-text">{row.name}</span>
                  <span className="text-right font-mono text-xs tabular-nums text-muted">{row.total}</span>
                  <span className="text-right font-mono text-xs tabular-nums text-muted">{row.manual}</span>
                  <span className="text-right font-mono text-xs tabular-nums text-muted">{row.folders}</span>
                  <span className={`font-mono text-xs ${row.scan === "failed" ? "text-st-failed" : row.scan === "scanning" ? "text-st-generating" : "text-dim"}`}>
                    {SCAN_LABEL[row.scan]}
                  </span>
                </button>
                <span className="flex justify-end">
                  <TwoStep
                    size="sm"
                    question={`Delete ${row.name}?`}
                    title="Delete the collection; the original files are untouched"
                    onConfirm={() => onDelete(row.id)}
                  >
                    Delete
                  </TwoStep>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Wide>
    </Group>
  );
}
