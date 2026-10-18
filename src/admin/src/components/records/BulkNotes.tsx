import { X } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import type { BulkNote } from "@/lib/bulk-plan";

export interface BulkNotesProps {
  readonly notes: readonly BulkNote[];
  readonly onDismiss: () => void;
}

/** What a bulk run left behind, listed under the toolbar: every row that failed or was skipped and the sentence why. It
 *  exists only after a run that left something to say, and goes with `Dismiss` or the next run. */
export function BulkNotes({ notes, onDismiss }: BulkNotesProps) {
  if (notes.length === 0) return null;
  return (
    <div role="status" aria-label="Bulk action results" className="flex flex-none items-start gap-2 border-b border-border bg-panel px-3 py-2">
      <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-0.5 p-0 text-xs">
        {notes.map((note) => (
          <li key={note.id} className="flex min-w-0 gap-2">
            <span className="truncate font-mono text-text">{note.label}</span>
            <span className="truncate text-st-failed">{note.sentence}</span>
          </li>
        ))}
      </ul>
      <IconButton aria-label="Dismiss results" title="Dismiss" onClick={onDismiss}>
        <X aria-hidden />
      </IconButton>
    </div>
  );
}
