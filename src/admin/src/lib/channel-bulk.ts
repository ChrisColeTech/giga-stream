import {
  ALL_DISABLED,
  ALL_ENABLED,
  ALREADY_DISABLED,
  ALREADY_ENABLED,
  REBUILD_DISABLED,
  STREAM_NO_REBUILD,
  UNREACHABLE_REASON,
  WORKING_REASON,
} from "@/constants/channel-copy";
import { TICK_FIRST } from "@/constants/record-copy";
import type { AdminChannel } from "@/types/admin-channel";
import { planBulk, type BulkPlan, type BulkWords } from "./bulk-plan";
import { findChannel, tickedChannels } from "./channel-list";

/* The Channels toolbar's bulk verbs on the ticked rows (`36` section 5.3), pure: which ticked channels each verb runs on,
 * which it skips and why, and why the verb itself is disabled. The run is the shared runner's (`39` section 6). */

export type ChannelBulkVerb = "enable" | "disable" | "rebuild" | "delete";

export const CHANNEL_BULK_VERBS: readonly ChannelBulkVerb[] = ["enable", "disable", "rebuild", "delete"];

export const CHANNEL_BULK_LABELS: Readonly<Record<ChannelBulkVerb, string>> = {
  enable: "Enable",
  disable: "Disable",
  rebuild: "Rebuild",
  delete: "Delete",
};

const words = (past: string): BulkWords => ({ past, noun: "channel", nouns: "channels" });

/** The summary's words: `Disabled 2 channels; 1 skipped.`, `Rebuilding 3 channels; 1 skipped.` */
export const CHANNEL_BULK_WORDS: Readonly<Record<ChannelBulkVerb, BulkWords>> = {
  enable: words("Enabled"),
  disable: words("Disabled"),
  rebuild: words("Rebuilding"),
  delete: words("Deleted"),
};

/** Why one ticked channel is skipped by a verb, or null to run it. */
export function skipReason(verb: ChannelBulkVerb, channel: AdminChannel): string | null {
  switch (verb) {
    case "enable":
      return channel.enabled ? ALREADY_ENABLED : null;
    case "disable":
      return channel.enabled ? null : ALREADY_DISABLED;
    case "rebuild":
      if (channel.kind === "stream") return STREAM_NO_REBUILD;
      return channel.enabled ? null : REBUILD_DISABLED;
    case "delete":
      return null;
  }
}

/** The plan of a verb over the ticked rows, in list order. */
export function planChannelBulk(
  verb: ChannelBulkVerb,
  items: readonly AdminChannel[],
  ticked: readonly string[],
): BulkPlan<string> {
  const rows = tickedChannels(items, ticked).map((channel) => ({ id: channel.id, label: channel.name }));
  return planBulk(rows, (row) => {
    const channel = findChannel(items, row.id);
    return channel === undefined ? null : skipReason(verb, channel);
  });
}

/** Why a verb is disabled, or undefined when at least one ticked row can run: nothing ticked, a run going, the backend
 *  unreachable, or every ticked row skipped (Enable and Disable say so for the whole set; Rebuild gives the first row's
 *  reason). Delete skips nothing. */
export function channelBulkReason(
  verb: ChannelBulkVerb,
  plan: BulkPlan<string>,
  tickedCount: number,
  state: { readonly working: boolean; readonly unreachable: boolean },
): string | undefined {
  if (tickedCount === 0) return TICK_FIRST;
  if (state.working) return WORKING_REASON;
  if (state.unreachable) return UNREACHABLE_REASON;
  if (plan.runnable.length > 0) return undefined;
  if (verb === "enable") return ALL_ENABLED;
  if (verb === "disable") return ALL_DISABLED;
  return plan.refused[0]?.reason;
}
