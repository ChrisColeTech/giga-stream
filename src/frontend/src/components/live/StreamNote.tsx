import { CircleAlert } from "lucide-react";
import {
  REASON_NEEDS_STREAM_FAILURE,
  RETRY_LABEL,
  STREAM_NOTE_SENTENCE,
  STREAM_NOTE_TITLE,
} from "@/lib/live-constants";
import { LiveNote } from "./LiveNote";

/** The failed-stream note: drawn only when a stream fails. Retry is disabled in phase 1 (`06` section 3.1). */
export function StreamNote() {
  return (
    <LiveNote
      icon={CircleAlert}
      title={STREAM_NOTE_TITLE}
      sentence={STREAM_NOTE_SENTENCE}
      action={RETRY_LABEL}
      reason={REASON_NEEDS_STREAM_FAILURE}
    />
  );
}
