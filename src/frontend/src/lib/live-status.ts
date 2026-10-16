import type { DotState } from "@/components/ui/StatusDot";
import type { ChannelStatus } from "@/types/channel";

/** A channel's status is a fact of its last probe: live is the done colour, offline the failed one, and a channel not yet
 *  probed the queued grey (`06` section 3.2). */
const DOT: Record<ChannelStatus, DotState> = {
  live: "done",
  offline: "failed",
  unknown: "queued",
};

/** The status word, read by assistive technology only (the dot carries the colour). */
const WORD: Record<ChannelStatus, string> = {
  live: "Live",
  offline: "Offline",
  unknown: "Not checked",
};

export function statusDot(status: ChannelStatus): DotState {
  return DOT[status];
}

export function statusWord(status: ChannelStatus): string {
  return WORD[status];
}
