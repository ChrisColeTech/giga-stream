import { Tv } from "lucide-react";
import { NO_CHANNELS_SENTENCE, NO_CHANNELS_TITLE, REFRESH_LABEL } from "@/lib/live-constants";
import { LiveNote } from "./LiveNote";

export interface NoChannelsNoteProps {
  /** Reads the channel list again. */
  readonly onRefresh: () => void;
}

/** The no-channels note: drawn only when the list is empty. Refresh channels reads the list again (`06` section 3.1). */
export function NoChannelsNote({ onRefresh }: NoChannelsNoteProps) {
  return (
    <LiveNote
      icon={Tv}
      title={NO_CHANNELS_TITLE}
      sentence={NO_CHANNELS_SENTENCE}
      action={REFRESH_LABEL}
      onAction={onRefresh}
    />
  );
}
