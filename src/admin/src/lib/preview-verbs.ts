import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/channel-copy";
import { NO_CHANNEL, RETRY_READING, UNCHECKED_TITLE } from "@/constants/preview-copy";
import type { AdminChannel } from "@/types/admin-channel";

/* The Preview toolbar's two toggles (`51` section 2.6), pure: the state each shows, the reason it cannot be flipped now
 *  and the note a title carries. `Enabled` is the channel's own boolean; `Online` is the stream verdict, explicit — the
 *  player's failure is never a guess at it. A toggle's label sits beside it in the toolbar. */

export interface ToggleVerb {
  /** What the switch reads this moment. */
  readonly checked: boolean;
  /** Why it cannot be flipped now; undefined when it works. */
  readonly reason: string | undefined;
  /** The switch's own tooltip (an unchecked stream's note); absent otherwise. A disabled switch's reason rides the
   *  wrapper instead: the browser drops a disabled control's title. */
  readonly title?: string;
}

export interface PreviewVerbPlan {
  readonly enabled: ToggleVerb;
  /** Null for a live-kind channel or no channel: the switch is absent, not disabled. */
  readonly online: ToggleVerb | null;
}

export interface VerbContext {
  /** The window is still reading the channels. */
  readonly reading: boolean;
  /** The backend could not be reached on the last call. */
  readonly unreachable: boolean;
  /** A verb of this toolbar is running. */
  readonly busy: boolean;
}

export function previewVerbs(channel: AdminChannel | undefined, context: VerbContext): PreviewVerbPlan {
  const reason = context.reading
    ? RETRY_READING
    : channel === undefined
      ? NO_CHANNEL
      : context.unreachable
        ? UNREACHABLE_REASON
        : context.busy
          ? SAVING_REASON
          : undefined;
  const enabled: ToggleVerb = { checked: channel?.enabled !== false, reason };
  if (channel?.kind !== "stream") return { enabled, online: null };
  const online: ToggleVerb =
    channel.status === undefined
      ? { checked: false, reason, title: UNCHECKED_TITLE }
      : { checked: channel.status === "online", reason };
  return { enabled, online };
}
