import type { Accent } from "@giga/ui/form/form-classes";
import type { ChannelStatus } from "@/types/channel";

/** A channel's status is a fact of its last probe (`06` section 3.2), drawn as the left-edge accent bar a queue row wears
 *  (LoRA Studio's QueueRow): live is the success bar, offline the error bar, a channel not yet probed the inactive one. */
const BAR: Record<ChannelStatus, Accent> = {
  live: "success",
  offline: "error",
  unknown: "inactive",
};

/** The status word, on the row's meta line beside the bar that carries the color. */
const WORD: Record<ChannelStatus, string> = {
  live: "Live",
  offline: "Offline",
  unknown: "Not checked",
};

export function statusBar(status: ChannelStatus): Accent {
  return BAR[status];
}

export function statusWord(status: ChannelStatus): string {
  return WORD[status];
}
