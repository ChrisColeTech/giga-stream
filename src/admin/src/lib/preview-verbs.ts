import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/channel-copy";
import { NO_CHANNEL, RETRY_READING } from "@/constants/preview-copy";
import type { AdminChannel } from "@/types/admin-channel";

/* The Preview toolbar's own verbs (`36` section 8.1), pure: the label each shows and the reason it cannot be pressed.
 * `Enable` / `Disable` shows the action the channel can take; `Mark live` / `Mark dead` the other verdict than the
 * channel's own, for a stream channel only (a live channel has no such button at all). */

export interface PreviewVerb {
  readonly label: string;
  /** Why it cannot be pressed now; undefined when it works. */
  readonly reason: string | undefined;
}

export interface PreviewVerbPlan {
  readonly enable: PreviewVerb;
  /** Null for a live channel or no channel: the button is absent, not disabled. */
  readonly mark: PreviewVerb | null;
}

export interface VerbContext {
  /** The window is still reading the channels. */
  readonly reading: boolean;
  /** The backend could not be reached on the last call. */
  readonly unreachable: boolean;
  /** A verb of this toolbar is running. */
  readonly busy: boolean;
  /** The player gave up on the stream: the tie-break for a stream nobody has checked. */
  readonly playerFailed: boolean;
}

export type Verdict = "live" | "dead";

/** The verdict `Mark` sets: the other than the channel's own; a stream never checked takes what the player saw. */
export function verdictToSet(channel: AdminChannel, playerFailed: boolean): Verdict {
  if (channel.kind !== "stream" || channel.status === undefined) return playerFailed ? "dead" : "live";
  return channel.status === "live" ? "dead" : "live";
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
  const enable = { label: channel?.enabled === false ? "Enable" : "Disable", reason };
  if (channel?.kind !== "stream") return { enable, mark: null };
  const verdict = verdictToSet(channel, context.playerFailed);
  return { enable, mark: { label: verdict === "live" ? "Mark live" : "Mark dead", reason } };
}
