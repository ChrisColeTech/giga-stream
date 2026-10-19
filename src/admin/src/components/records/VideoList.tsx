import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Input } from "@giga/ui/controls/Input";
import { cn } from "@giga/ui/lib/cn";
import { END_ACTIONS_PX } from "@giga/ui/lib/window-constants";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { RecordTable } from "@giga/ui/lists/RecordTable";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { addReason, addVideo, downReason, moveVideo, removeVideo, upReason } from "@/lib/video-order";
import { videoEntryColumns, type VideoEntryRow } from "./video-entry-columns";

const idOf = (row: VideoEntryRow): string => String(row.position);

export interface VideoListProps {
  readonly videos: readonly string[];
  readonly onChange: (videos: string[]) => void;
  /** A refused path (`videos.<n>`) shows under the row, so the list carries it as invalid. */
  readonly invalid?: boolean;
}

/** A live channel's videos in play order (`28` Appendix A row 76, `36` section 6; `52` decision 3): the standard table
 *  - `#`, the path in mono - bounded, no ticks, nothing sortable, no record to open; each row's end cell holds the up,
 *  down and remove icon buttons with their reasons (`Already first`, `Already last`) in a wider end column. Above 100
 *  entries the table windows through a synthetic paging over its own array (`52` decision 4). Under it the add row
 *  stays: a path field and `Add` (no `Choose`: the backend window's dialog picks folders only). Edits change the draft;
 *  Save sends them. */
export function VideoList({ videos, onChange, invalid = false }: VideoListProps) {
  const [path, setPath] = useState("");
  const reason = addReason(videos, path);
  const add = (): void => {
    if (reason !== undefined) return;
    onChange(addVideo(videos, path));
    setPath("");
  };

  const rows = useMemo<VideoEntryRow[]>(
    () => videos.map((video, position) => ({ position, path: video })),
    [videos],
  );
  const rowAt = useCallback((index: number): VideoEntryRow | undefined => rows[index], [rows]);
  const rowView = (row: VideoEntryRow): RecordRowView => ({
    end: (
      <span className="flex items-center gap-1">
        <IconButton
          aria-label={`Move ${row.path} up`}
          reason={upReason(row.position)}
          onClick={() => onChange(moveVideo(videos, row.position, -1))}
        >
          <ArrowUp className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton
          aria-label={`Move ${row.path} down`}
          reason={downReason(row.position, videos.length)}
          onClick={() => onChange(moveVideo(videos, row.position, 1))}
        >
          <ArrowDown className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton aria-label={`Remove ${row.path}`} title="Remove" onClick={() => onChange(removeVideo(videos, row.position))}>
          <X className="size-3.5" aria-hidden />
        </IconButton>
      </span>
    ),
  });

  return (
    <div className="flex w-full min-w-0 flex-col gap-1" aria-invalid={invalid || undefined}>
      <RecordTable<VideoEntryRow>
        ariaLabel="Videos"
        columns={videoEntryColumns}
        paging={{ total: rows.length, rowAt, resetKey: "" }}
        idOf={idOf}
        rowView={rowView}
        ticks={false}
        size="bounded"
        endPx={END_ACTIONS_PX}
      />
      <div className="flex min-w-0 items-center gap-2">
        <Input
          value={path}
          className={cn(FIELD_CONTROL, "font-mono")}
          aria-label="Video to add"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setPath(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
        />
        <Button variant="ghost" reason={reason} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
