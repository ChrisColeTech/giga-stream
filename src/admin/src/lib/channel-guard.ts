import {
  FAULT_NONE,
  FAULT_NOT_LIVE,
  REBUILD_DISABLED,
  REVERT_HAND_MADE,
  REVERT_NONE,
  STREAM_NO_REBUILD,
} from "@/constants/channel-copy";
import { SAVE_FIRST, TICK_FIRST, TICK_ONE } from "@/constants/record-copy";
import type { AdminChannel, LiveAdminChannel, StreamAdminChannel } from "@/types/admin-channel";
import { writeReason, type WriteState } from "./channel-check";

/* Every disabled reason of the Channels tab (`36` sections 5 to 8), in one place, pure. A control is enabled exactly when
 * its function answers undefined; otherwise it stays in place, natively disabled, with the sentence as its tooltip. */

/** The index's `Preview →`: exactly one ticked row, live or stream. A New form never gates it. */
export function previewIndexReason(tickedCount: number): string | undefined {
  if (tickedCount === 0) return TICK_FIRST;
  return tickedCount > 1 ? TICK_ONE : undefined;
}

/** A workspace's `Preview →`: the saved channel plays, so a draft with changes must be saved first. */
export const previewWorkspaceReason = (dirty: boolean): string | undefined => (dirty ? SAVE_FIRST : undefined);

/** `Rebuild` in a live Details group: a saved, enabled live channel, and no other write running. */
export function rebuildReason(channel: AdminChannel, dirty: boolean, write: WriteState): string | undefined {
  if (channel.kind === "stream") return STREAM_NO_REBUILD;
  if (dirty) return SAVE_FIRST;
  if (!channel.enabled) return REBUILD_DISABLED;
  return writeReason(write);
}

/** The Fault group's `Apply`: a test tool for a running stream, so only while the channel is live. */
export function applyReason(channel: LiveAdminChannel, write: WriteState): string | undefined {
  return channel.state === "live" ? writeReason(write) : FAULT_NOT_LIVE;
}

/** The Fault group's `Clear`: only while a fault is set. */
export function clearReason(channel: LiveAdminChannel, write: WriteState): string | undefined {
  return channel.fault === null ? FAULT_NONE : writeReason(write);
}

/** `Revert to playlist`: only a synced row with edits has anything to go back to. */
export function revertReason(channel: StreamAdminChannel, write: WriteState): string | undefined {
  if (channel.source === undefined) return REVERT_HAND_MADE;
  if ((channel.editedFields ?? []).length === 0) return REVERT_NONE;
  return writeReason(write);
}
