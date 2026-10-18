import {
  ALL_DISABLED,
  ALL_ENABLED,
  ALREADY_DISABLED,
  ALREADY_ENABLED,
  NOT_LOADED,
  REBUILD_DISABLED,
  STREAM_NO_REBUILD,
  UNREACHABLE_REASON,
  WORKING_REASON,
} from "@/constants/channel-copy";
import { TICK_FIRST } from "@/constants/record-copy";
import type { AdminChannel } from "@/types/admin-channel";
import { planBulk, type BulkPlan, type BulkWords } from "./bulk-plan";
import { tickedChannels } from "./channel-list";

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

/** The plan of a verb over the ticked ids. `items` are the rows the tab holds whole (the ticked ones, kept across
 *  pages: `heldTicked`); a ticked id with no row held is skipped with `Not loaded.` and stays ticked, so the summary
 *  says how many were skipped. The rows run in `items` order. */
export function planChannelBulk(
  verb: ChannelBulkVerb,
  items: readonly AdminChannel[],
  ticked: readonly string[],
): BulkPlan<string> {
  const rows = tickedChannels(items, ticked);
  const have = new Set(rows.map((channel) => channel.id));
  const byId = new Map(rows.map((channel) => [channel.id, channel]));
  const unheld = ticked.filter((id) => !have.has(id)).map((id) => ({ id, label: id }));
  return planBulk([...rows.map((channel) => ({ id: channel.id, label: channel.name })), ...unheld], (row) => {
    const channel = byId.get(row.id);
    return channel === undefined ? NOT_LOADED : skipReason(verb, channel);
  });
}

/** The most stream ids one `PATCH /api/channels` takes (`43` section 3.3); Enable and Disable never chunk. */
export const CHANNEL_SWITCH_MAX = 5_000;

/** Does Enable or Disable have more stream rows to switch than the one call takes? */
export function overSwitchLimit(plan: BulkPlan<string>, items: readonly AdminChannel[]): boolean {
  const live = new Set(items.filter((channel) => channel.kind === "live").map((channel) => channel.id));
  return plan.runnable.filter((row) => !live.has(row.id)).length > CHANNEL_SWITCH_MAX;
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
