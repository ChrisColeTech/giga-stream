import { Folder, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SkeletonCards } from "@/components/ui/SkeletonCards";
import { cn } from "@/lib/cn";
import type { CollectionRow } from "@/types/collection";

/* LoRA Studio's index tiles (components/library/LibraryTiles.tsx), for collections: a glyph tile with the counts on it,
 * the name, a mono meta line, the pencil that fills the form above for editing, and an inline two-step remove (Remove,
 * Keep; confirmation is inline, never a dialog). Grid or list. Loading and empty both draw the skeleton grid. A
 * collection has no picture of its own, so the tile is its folder glyph. */

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const meta = (row: CollectionRow) =>
  [plural(row.folders, "folder"), row.scan === "scanning" ? "scanning" : row.scan === "failed" ? "scan failed" : null]
    .filter((part): part is string => part !== null)
    .join(" · ");
const counts = (row: CollectionRow) => `${row.total} · ${row.manual} manual`;

export interface CollectionTilesProps {
  readonly rows: readonly CollectionRow[];
  readonly view: "grid" | "list";
  readonly onOpen: (row: CollectionRow) => void;
  readonly onEdit: (row: CollectionRow) => void;
  readonly confirmId: string | null;
  readonly onAskRemove: (id: string) => void;
  readonly onRemove: (row: CollectionRow) => void;
  readonly onKeep: () => void;
}

export function CollectionTiles({ rows, view, onOpen, onEdit, confirmId, onAskRemove, onRemove, onKeep }: CollectionTilesProps) {
  if (rows.length === 0) return <SkeletonCards count={8} />;
  const edit = (row: CollectionRow) =>
    confirmId === row.id ? null : (
      <button
        type="button"
        className="grid size-7 flex-none cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-dim opacity-0 hover:bg-hov hover:text-text group-hover:opacity-100 focus-visible:opacity-100"
        title="Edit collection — change its name"
        aria-label={`Edit collection ${row.name}`}
        onClick={() => onEdit(row)}
      >
        <Pencil className="size-3.5" />
      </button>
    );
  const remove = (row: CollectionRow) =>
    confirmId === row.id ? (
      <span className="flex items-center gap-1">
        <Button size="sm" variant="danger" title="Original files remain untouched." onClick={() => onRemove(row)}>
          Remove
        </Button>
        <Button size="sm" variant="ghost" onClick={onKeep}>
          Keep
        </Button>
      </span>
    ) : (
      <button
        type="button"
        className="grid size-7 flex-none cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-dim opacity-0 hover:bg-hov hover:text-st-failed group-hover:opacity-100 focus-visible:opacity-100"
        title="Remove this collection; original files remain untouched"
        aria-label={`Remove ${row.name}`}
        onClick={() => onAskRemove(row.id)}
      >
        <Trash2 className="size-3.5" />
      </button>
    );

  if (view === "list")
    return (
      <div className="flex flex-col divide-y divide-hair/60">
        {rows.map((row) => (
          <div key={row.id} className="group flex items-center gap-3 py-1.5">
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-ctl border-0 bg-transparent px-1 py-0.5 text-left hover:bg-hov"
              title={meta(row)}
              onClick={() => onOpen(row)}
            >
              <span className="grid size-10 flex-none place-items-center overflow-hidden rounded-ctl border border-border bg-bg">
                <Folder className="size-4 text-dim" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">{row.name}</span>
                <span className="block truncate font-mono text-xs text-dim">{meta(row)}</span>
              </span>
              <span className="w-44 flex-none font-mono text-xs tabular-nums text-muted">{counts(row)}</span>
            </button>
            {edit(row)}
            {remove(row)}
          </div>
        ))}
      </div>
    );
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
      {rows.map((row) => (
        <div key={row.id} className="group flex flex-col gap-1.5">
          <button
            type="button"
            className={cn(
              "relative flex aspect-4/3 w-full cursor-pointer items-center justify-center overflow-hidden rounded-card border border-border bg-bg p-0 transition-colors duration-fade hover:border-dim",
            )}
            title={meta(row)}
            onClick={() => onOpen(row)}
          >
            <Folder className="size-8 text-dim" aria-hidden />
            <span className="absolute right-1.5 bottom-1.5 rounded-ctl bg-[color-mix(in_srgb,var(--color-bg)_78%,transparent)] px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted">
              {counts(row)}
            </span>
          </button>
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-text">{row.name}</span>
              <span className="block truncate font-mono text-xs text-dim" title={meta(row)}>
                {meta(row)}
              </span>
            </div>
            {edit(row)}
            {remove(row)}
          </div>
        </div>
      ))}
    </div>
  );
}
