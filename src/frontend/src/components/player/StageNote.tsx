import { CircleAlert } from "lucide-react";
import { LiveNote } from "@/components/live/LiveNote";
import { RETRY_LABEL, STREAM_NOTE_TITLE } from "@/lib/live-constants";

export interface StageNoteProps {
  /** The reason the stream failed, in one sentence. */
  readonly reason: string;
  readonly onRetry: () => void;
}

/** The note over the picture when a stream fails (`06` section 5.3): Live's stage note, so the two stages report a
 *  failure the same way (an icon, the title, the reason and Retry), in a band that stops above the player's controls. */
export function StageNote({ reason, onRetry }: StageNoteProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 bottom-12 flex items-center justify-center p-4">
      <LiveNote icon={CircleAlert} title={STREAM_NOTE_TITLE} sentence={reason} action={RETRY_LABEL} onAction={onRetry} />
    </div>
  );
}
