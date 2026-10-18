import { ApiError } from "@giga/http/api-error";
import { REQUEST_FAILED } from "@/constants/channel-copy";
import { FAILURE_CODES } from "@/constants/api-sentences";
import { bulkCountsSummary, type BulkItem, type BulkPlan } from "@/lib/bulk-plan";
import { CHANNEL_BULK_WORDS } from "@/lib/channel-bulk";
import type { AdminChannel } from "@/types/admin-channel";
import type { BulkStore } from "./bulk-run";
import type { ChannelStore } from "./channel-flow-support";
import type { ChannelsService } from "./channels";

export type ChannelSwitchStore = Pick<ChannelStore, "channels" | "channelUpsert" | "channelsMarkUnreachable"> &
  Pick<BulkStore, "serial" | "signedIn" | "say" | "logEvent" | "work" | "setWork"> & {
    readonly channelsSetTicked: (ids: readonly string[]) => void;
  };

export interface ChannelSwitchDeps {
  readonly service: Pick<ChannelsService, "setEnabled" | "update">;
  readonly store: () => ChannelSwitchStore;
  /** Reads the list again, once, at the end. */
  readonly reread: () => Promise<unknown>;
}

/** Bulk Enable and Disable (`43` sections 3.3 and 4.1): every runnable STREAM row goes in ONE `PATCH /api/channels` (up
 *  to 5,000 ids, never chunked), the live-kind rows keep their single `PATCH` each. One summary sentence for the whole
 *  run (`Disabled 4,800 channels; 200 skipped.`): the backend's `unchanged` and `skipped` and the plan's own refusals
 *  count as skipped, a failed call counts its rows as failed. The rows that finished are unticked, the list is read once
 *  at the end, and a session that ended under the call says nothing. */
export function createChannelSwitch(deps: ChannelSwitchDeps): (enabled: boolean, plan: BulkPlan<string>) => Promise<void> {
  const { service, store, reread } = deps;
  const kindOf = (id: string): AdminChannel["kind"] | undefined => store().channels.held[id]?.kind;
  const sentence = (error: unknown): string => (error instanceof ApiError ? error.message : REQUEST_FAILED);
  const mark = (error: unknown): void => {
    if (error instanceof ApiError && error.code === FAILURE_CODES.unreachable) store().channelsMarkUnreachable(true);
  };

  return async (enabled, plan) => {
    const serial = store().serial;
    const alive = (): boolean => store().signedIn && store().serial === serial;
    const streams = plan.runnable.filter((item) => kindOf(item.id) !== "live");
    const lives = plan.runnable.filter((item) => kindOf(item.id) === "live");
    const finished: string[] = [];
    let changed = 0;
    let skipped = plan.refused.length;
    let failed = 0;
    const fail = (items: readonly BulkItem<string>[], reason: string): void => {
      failed += items.length;
      store().logEvent({ tone: "warn", area: "Channel", identity: `${items.length} channels`, sentence: reason });
    };
    store().setWork({ syncing: store().work.syncing + 1 });
    try {
      if (streams.length > 0) {
        try {
          const answer = await service.setEnabled(streams.map((item) => item.id), enabled);
          changed += answer.changed;
          skipped += answer.unchanged + answer.skipped;
          finished.push(...streams.map((item) => item.id));
        } catch (error: unknown) {
          mark(error);
          fail(streams, sentence(error));
        }
      }
      for (const item of lives) {
        if (!alive()) break;
        try {
          store().channelUpsert(await service.update(item.id, { enabled }));
          changed += 1;
          finished.push(item.id);
        } catch (error: unknown) {
          mark(error);
          fail([item], `${item.label}: ${sentence(error)}`);
        }
      }
    } finally {
      store().setWork({ syncing: Math.max(0, store().work.syncing - 1) });
    }
    if (!alive()) return;
    const gone = new Set(finished);
    store().channelsSetTicked(store().channels.ticked.filter((id) => !gone.has(id)));
    const summary = bulkCountsSummary(CHANNEL_BULK_WORDS[enabled ? "enable" : "disable"], { done: changed, failed, skipped });
    store().say(summary.sentence, summary.tone, "Channel");
    if (plan.runnable.length > 0) await reread();
  };
}
