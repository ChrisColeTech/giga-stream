import { CircleAlert } from "lucide-react";
import { RETRY_LABEL, STREAM_NOTE_SENTENCE, STREAM_NOTE_TITLE } from "@/lib/live-constants";
import { LiveNote } from "./LiveNote";

export interface StreamNoteProps {
  /** Loads the same stream address again. */
  readonly onRetry: () => void;
}

/** The failed-stream note: drawn only when a stream fails. Retry loads the same address again (`06` section 3.1). */
export function StreamNote({ onRetry }: StreamNoteProps) {
  return (
    <LiveNote
      icon={CircleAlert}
      title={STREAM_NOTE_TITLE}
      sentence={STREAM_NOTE_SENTENCE}
      action={RETRY_LABEL}
      onAction={onRetry}
    />
  );
}
