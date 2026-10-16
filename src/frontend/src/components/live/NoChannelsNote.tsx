import { Tv } from "lucide-react";
import {
  NO_CHANNELS_SENTENCE,
  NO_CHANNELS_TITLE,
  REASON_NEEDS_FILESERVER,
  REFRESH_LABEL,
} from "@/lib/live-constants";
import { LiveNote } from "./LiveNote";

/** The no-channels note: drawn only when the list is empty. Refresh channels is disabled in phase 1 (`06` section 3.1). */
export function NoChannelsNote() {
  return (
    <LiveNote
      icon={Tv}
      title={NO_CHANNELS_TITLE}
      sentence={NO_CHANNELS_SENTENCE}
      action={REFRESH_LABEL}
      reason={REASON_NEEDS_FILESERVER}
    />
  );
}
