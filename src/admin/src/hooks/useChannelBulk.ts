import { useMemo } from "react";
import { bulkDeleteQuestion, DELETE_SYNCED_TIP } from "@/constants/channel-copy";
import { bulkSummary, type BulkNote, type BulkOutcome } from "@/lib/bulk-plan";
import {
  CHANNEL_BULK_LABELS,
  CHANNEL_BULK_VERBS,
  CHANNEL_BULK_WORDS,
  channelBulkReason,
  planChannelBulk,
  type ChannelBulkVerb,
} from "@/lib/channel-bulk";
import { findChannel } from "@/lib/channel-list";
import { isSynced } from "@/lib/channel-rows";
import { createChannelBulkCall } from "@/services/channel-bulk";
import { channels } from "@/services/channels";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useChannelFlows } from "./useChannelFlows";

export interface ChannelBulkVerbView {
  readonly verb: ChannelBulkVerb;
  readonly label: string;
  /** Why it cannot run now; undefined when at least one ticked row can. */
  readonly reason: string | undefined;
  /** Delete's armed question, naming how many die. */
  readonly question?: string;
  readonly press: () => void;
}

export interface ChannelBulk {
  readonly verbs: readonly ChannelBulkVerbView[];
  readonly notes: readonly BulkNote[];
  readonly dismiss: () => void;
  /** A run is going: the New form's Create waits too. */
  readonly working: boolean;
}

/** The Channels toolbar's bulk verbs over the ticked rows (`36` section 5.3): Enable, Disable, Rebuild and an armed Delete,
 *  through the shared runner, one single-channel call per row, one summary, one re-read at the end; the rows that finished
 *  are unticked, failed and skipped rows stay ticked. Deleting synced rows says that the next sync adds them again. */
export function useChannelBulk(): ChannelBulk {
  const flows = useChannelFlows();
  const bulk = useBulkAction();
  const items = useAppStore((state) => state.channels.items);
  const ticked = useAppStore((state) => state.channels.ticked);
  const unreachable = useAppStore((state) => state.channels.unreachable);
  const call = useMemo(() => createChannelBulkCall({ service: channels, store: () => useAppStore.getState() }), []);

  const verbs = CHANNEL_BULK_VERBS.map((verb): ChannelBulkVerbView => {
    const plan = planChannelBulk(verb, items, ticked);
    const synced = plan.runnable.some((row) => {
      const channel = findChannel(items, row.id);
      return channel !== undefined && isSynced(channel);
    });
    const press = async (): Promise<void> => {
      const seen: { outcome: BulkOutcome<string> | null } = { outcome: null };
      await bulk.run({
        words: CHANNEL_BULK_WORDS[verb],
        area: "Channel",
        plan,
        perform: call(verb),
        finish: (result) => {
          seen.outcome = result;
          const now = useAppStore.getState();
          now.channelsSetTicked(now.channels.ticked.filter((id) => !result.done.some((row) => row.id === id)));
        },
        reread: flows.refresh,
      });
      if (verb !== "delete" || !synced || seen.outcome === null) return;
      const now = useAppStore.getState();
      now.markStale("playlists");
      const summary = bulkSummary(CHANNEL_BULK_WORDS.delete, seen.outcome);
      now.say(`${summary.sentence} ${DELETE_SYNCED_TIP}`, summary.tone, "Channel");
    };
    return {
      verb,
      label: CHANNEL_BULK_LABELS[verb],
      reason: channelBulkReason(verb, plan, ticked.length, { working: bulk.running, unreachable }),
      ...(verb === "delete" && { question: bulkDeleteQuestion(plan.runnable.length) }),
      press: () => void press(),
    };
  });
  return { verbs, notes: bulk.notes, dismiss: bulk.dismiss, working: bulk.running };
}
