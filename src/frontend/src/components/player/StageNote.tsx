import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface StageNoteProps {
  /** The reason the stream failed, in one sentence. */
  readonly reason: string;
  readonly onRetry: () => void;
}

/** The centred note over the picture when a stream fails (`06` section 5.3): an icon, the reason and Retry, clear of the
 *  player's own controls. */
export function StageNote({ reason, onRetry }: StageNoteProps) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
      <div className="pointer-events-auto flex max-w-[320px] flex-col items-center gap-2.5 rounded-card border border-border bg-panel p-4 text-center shadow-menu">
        <CircleAlert className="size-5 text-st-failed" aria-hidden />
        <p className="m-0 text-[13px] text-text">{reason}</p>
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}
