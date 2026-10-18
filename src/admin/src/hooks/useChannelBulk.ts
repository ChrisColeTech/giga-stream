import { useMemo, useState } from "react";
import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";
import { bulkDeleteQuestion, DELETE_SYNCED_TIP, TOO_MANY_TO_SWITCH } from "@/constants/channel-copy";
import { bulkSummary, type BulkOutcome } from "@/lib/bulk-plan";
import {
  CHANNEL_BULK_LABELS,
  CHANNEL_BULK_VERBS,
  CHANNEL_BULK_WORDS,
  channelBulkReason,
  overSwitchLimit,
  planChannelBulk,
} from "@/lib/channel-bulk";
import { heldTicked } from "@/lib/channel-list";
import { isSynced } from "@/lib/channel-rows";
import { createChannelBulkCall } from "@/services/channel-bulk";
import { createChannelSwitch } from "@/services/channel-switch";
import { channels } from "@/services/channels";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { useChannelFlows } from "./useChannelFlows";

export interface ChannelBulk {
  /** The table strip's verbs; Delete carries its armed question naming how many die. */
  readonly verbs: readonly StripVerb[];
  /** A run is going: the New form's Create waits too. */
  readonly working: boolean;
}

/** The Channels table strip's bulk verbs over the ticked rows (`36` section 5.3): Enable, Disable, Rebuild and an armed Delete.
 *  Enable and Disable make ONE `PATCH /api/channels` for the ticked stream rows (`services/channel-switch.ts`); Rebuild and
 *  Delete go through the shared runner, one single-channel call per row. One summary, one re-read at the end; the rows that finished
 *  are unticked, failed and skipped rows stay ticked. Deleting synced rows says that the next sync adds them again. */
export function useChannelBulk(): ChannelBulk {
  const flows = useChannelFlows();
  const bulk = useBulkAction();
  const held = useAppStore((state) => state.channels.held);
  const ticked = useAppStore((state) => state.channels.ticked);
  const unreachable = useAppStore((state) => state.channels.unreachable);
  const call = useMemo(() => createChannelBulkCall({ service: channels, store: () => useAppStore.getState() }), []);
  const [switchBusy, setSwitchBusy] = useState(false);
  const switchTicked = useMemo(
    () => createChannelSwitch({ service: channels, store: () => useAppStore.getState(), reread: flows.refresh }),
    [flows],
  );
  const working = bulk.running || switchBusy;
  const items = useMemo(() => heldTicked(held, ticked), [held, ticked]);

  const verbs = CHANNEL_BULK_VERBS.map((verb): StripVerb => {
    const plan = planChannelBulk(verb, items, ticked);
    const synced = plan.runnable.some((row) => {
      const channel = held[row.id];
      return channel !== undefined && isSynced(channel);
    });
    const switching = verb === "enable" || verb === "disable";
    const reason =
      channelBulkReason(verb, plan, ticked.length, { working, unreachable }) ??
      (switching && overSwitchLimit(plan, items) ? TOO_MANY_TO_SWITCH : undefined);
    const press = async (): Promise<void> => {
      if (switching) {
        setSwitchBusy(true);
        try {
          await switchTicked(verb === "enable", plan);
        } finally {
          setSwitchBusy(false);
        }
        return;
      }
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
      id: verb,
      label: CHANNEL_BULK_LABELS[verb],
      icon: BULK_ICONS[verb],
      tip: BULK_TIPS[verb],
      reason,
      ...(verb === "delete" && { question: bulkDeleteQuestion(plan.runnable.length) }),
      onPress: () => void press(),
    };
  });
  return { verbs, working };
}
