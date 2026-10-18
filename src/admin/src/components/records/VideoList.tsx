import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@giga/ui/controls/Button";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Input } from "@giga/ui/controls/Input";
import { cn } from "@giga/ui/lib/cn";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { addReason, addVideo, downReason, moveVideo, removeVideo, upReason } from "@/lib/video-order";

export interface VideoListProps {
  readonly videos: readonly string[];
  readonly onChange: (videos: string[]) => void;
  /** A refused path (`videos.<n>`) shows under the row, so the list carries it as invalid. */
  readonly invalid?: boolean;
}

/** A live channel's videos in play order (`28` Appendix A row 76, `36` section 6): numbered rows, each the path in mono with
 *  up, down and remove; the end buttons are disabled with `Already first` / `Already last`. Under them an add row: a path
 *  field and `Add` (no `Choose`: the backend window's dialog picks folders only). Edits change the draft; Save sends them. */
export function VideoList({ videos, onChange, invalid = false }: VideoListProps) {
  const [path, setPath] = useState("");
  const reason = addReason(videos, path);
  const add = (): void => {
    if (reason !== undefined) return;
    onChange(addVideo(videos, path));
    setPath("");
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-1" aria-invalid={invalid || undefined}>
      <ol className="m-0 flex list-none flex-col p-0" aria-label="Videos">
        {videos.map((video, index) => (
          <li key={`${index}:${video}`} className="flex h-9 min-w-0 items-center gap-2 rounded-ctl px-2 hover:bg-hov">
            <span className="w-6 flex-none text-right font-mono text-xs text-faint">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-text" title={video}>
              {video}
            </span>
            <IconButton aria-label={`Move ${video} up`} reason={upReason(index)} onClick={() => onChange(moveVideo(videos, index, -1))}>
              <ArrowUp className="size-3.5" aria-hidden />
            </IconButton>
            <IconButton
              aria-label={`Move ${video} down`}
              reason={downReason(index, videos.length)}
              onClick={() => onChange(moveVideo(videos, index, 1))}
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </IconButton>
            <IconButton aria-label={`Remove ${video}`} title="Remove" onClick={() => onChange(removeVideo(videos, index))}>
              <X className="size-3.5" aria-hidden />
            </IconButton>
          </li>
        ))}
      </ol>
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
