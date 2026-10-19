import type { StripVerb } from "@giga/ui/lists/TableStrip";
import { BULK_DELETE, BULK_DISABLE, BULK_ENABLE } from "@/constants/account-copy";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";
import { SYNC_NOW, SYNC_ONE_TIP } from "@/constants/playlist-copy";
import type { BulkWords } from "@/lib/bulk-plan";
import {
  PLAYLIST_BULK_ORDER,
  PLAYLIST_BULK_WORDS,
  deleteWords,
  planPlaylistBulk,
  playlistVerbReason,
  type PlaylistBulkVerb,
} from "@/lib/playlist-bulk";
import type { ToolbarVerb } from "@/lib/workspace-verbs";
import { useAppStore } from "@/store/app-store";
import { useBulkAction } from "./useBulkAction";
import { usePlaylistActions } from "./usePlaylistActions";

export interface PlaylistBulk {
  /** The table strip's bulk verbs, in order, always drawn; Delete carries its armed question. */
  readonly verbs: readonly StripVerb[];
  /** The page toolbar's Sync now over the ticked set, or the workspace's one playlist. */
  readonly promote: ToolbarVerb;
}

const LABELS: Readonly<Record<PlaylistBulkVerb, string>> = {
  sync: SYNC_NOW,
  enable: BULK_ENABLE,
  disable: BULK_DISABLE,
  delete: BULK_DELETE,
};

/** The Playlists table strip's bulk verbs over the ticked rows (`38` section 3.2): Sync now (each playlist's own job, one
 *  after another), Enable, Disable and an armed Delete. Each runs through the shared bulk runner; the rows that
 *  finished are unticked, failed and skipped rows stay ticked and are Events rows. Delete and Sync now mark the Jobs
 *  and Channels tabs stale once at the end; Enable and Disable mark Jobs (its gate reads the playlist's state). */
export function usePlaylistBulk(target?: readonly number[], blocked = false): PlaylistBulk {
  const { flows } = usePlaylistActions();
  const bulk = useBulkAction();
  const items = useAppStore((state) => state.playlists.items);
  const ticked = useAppStore((state) => state.playlists.ticked);
  const jobFor = useAppStore((state) => state.playlists.jobFor);
  const unreachable = useAppStore((state) => state.playlists.unreachable);
  const selected = target ?? ticked;
  const busy = bulk.running || blocked;

  const press = (verb: PlaylistBulkVerb): void => {
    const plan = planPlaylistBulk(verb, items, selected, jobFor);
    const tally = { channels: 0, jobs: 0 };
    const words: BulkWords = verb === "delete" ? deleteWords(tally) : PLAYLIST_BULK_WORDS[verb];
    void bulk.run({
      words,
      area: "Playlist",
      plan,
      perform: flows.bulkCall(verb, tally),
      finish: (outcome) => {
        const now = useAppStore.getState();
        now.playlistsSetTicked(now.playlists.ticked.filter((id) => !outcome.done.some((item) => item.id === id)));
        if (outcome.done.length === 0) return;
        now.markStale("jobs");
        if (verb === "delete" || verb === "sync") now.markStale("channels");
      },
      reread: flows.refresh,
    });
  };
  const verbs = PLAYLIST_BULK_ORDER.map((verb): StripVerb => {
    const plan = planPlaylistBulk(verb, items, selected, jobFor);
    const count = plan.runnable.length;
    return {
      id: verb,
      label: LABELS[verb],
      icon: BULK_ICONS[verb],
      tip: BULK_TIPS[verb],
      reason: playlistVerbReason(verb, plan, selected.length, { busy, unreachable }),
      onPress: () => press(verb),
      ...(verb === "delete" && { question: `Delete ${count} ${count === 1 ? "playlist" : "playlists"}?` }),
    };
  });
  const syncPlan = planPlaylistBulk("sync", items, selected, jobFor);
  const promote: ToolbarVerb = {
    label: SYNC_NOW,
    tip: target === undefined ? BULK_TIPS.sync : SYNC_ONE_TIP,
    reason: playlistVerbReason("sync", syncPlan, selected.length, { busy, unreachable }),
    onPress: () => press("sync"),
  };
  return { verbs, promote };
}
