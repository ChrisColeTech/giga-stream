import { WORKING_REASON } from "@/constants/job-copy";
import {
  EVERY_PLAYLIST_DISABLED,
  EVERY_PLAYLIST_ENABLED,
  SYNC_JOB_DISABLED,
  SYNC_JOB_RUNNING,
  SYNC_NO_JOB,
  SYNC_PLAYLIST_DISABLED,
} from "@/constants/playlist-copy";
import { ALREADY_DISABLED, ALREADY_ENABLED, UNREACHABLE_REASON } from "@/constants/account-copy";
import { TICK_FIRST } from "@/constants/record-copy";
import type { AdminJob } from "@/services/schemas/job-schema";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import type { PlaylistJobLink } from "@/store/playlists-slice";
import { planBulk, type BulkPlan, type BulkWords } from "./bulk-plan";
import { playlistIdOf } from "./job-rows";
import { tickedOf } from "./playlist-rows";

/* The Playlists toolbar's bulk verbs (`38` section 3.2), pure: which ticked playlists each verb runs on and why the
 * others are skipped. `Sync now` starts the playlist's own job (the backend starts it and answers at once). */

export type PlaylistBulkVerb = "sync" | "enable" | "disable" | "delete";

export const PLAYLIST_BULK_ORDER: readonly PlaylistBulkVerb[] = ["sync", "enable", "disable", "delete"];

const words = (past: string): BulkWords => ({ past, noun: "playlist", nouns: "playlists" });

export const PLAYLIST_BULK_WORDS: Readonly<Record<Exclude<PlaylistBulkVerb, "delete">, BulkWords>> = {
  sync: words("Synced"),
  enable: words("Enabled"),
  disable: words("Disabled"),
};

/** Delete's words carry the channels that went with the playlists: the shared summary reads them after the run, so
 *  `Deleted 2 playlists and 14 channels.` (the sum of every `deletedChannels`) is the one sentence on the notice line. */
export function deleteWords(tally: { readonly channels: number }): BulkWords {
  const went = (): string => ` and ${tally.channels.toLocaleString("en-US")} ${tally.channels === 1 ? "channel" : "channels"}`;
  return {
    past: "Deleted",
    get noun() {
      return `playlist${went()}`;
    },
    get nouns() {
      return `playlists${went()}`;
    },
  };
}

const rank = (link: PlaylistJobLink): number => (!link.enabled ? 2 : link.running ? 1 : 0);

/** The job that syncs each playlist, from the jobs list: an enabled idle one first, then an enabled running one, then
 *  a disabled one. */
export function jobForPlaylists(jobs: readonly AdminJob[]): Record<number, PlaylistJobLink> {
  const map: Record<number, PlaylistJobLink> = {};
  for (const job of jobs) {
    const playlistId = playlistIdOf(job);
    if (playlistId === null) continue;
    const link = { id: job.id, enabled: job.enabled, running: job.running };
    const held = map[playlistId];
    if (held === undefined || rank(link) < rank(held)) map[playlistId] = link;
  }
  return map;
}

/** Why `Sync now` skips a playlist, or null to run its job. */
export function syncSkip(playlist: AdminPlaylist, link: PlaylistJobLink | undefined): string | null {
  if (!playlist.enabled) return SYNC_PLAYLIST_DISABLED;
  if (link === undefined) return SYNC_NO_JOB;
  if (!link.enabled) return SYNC_JOB_DISABLED;
  return link.running ? SYNC_JOB_RUNNING : null;
}

export function planPlaylistBulk(
  verb: PlaylistBulkVerb,
  items: readonly AdminPlaylist[],
  ticked: readonly number[],
  jobFor: Readonly<Record<number, PlaylistJobLink>>,
): BulkPlan<number> {
  const rows = tickedOf(items, ticked);
  return planBulk(
    rows.map((row) => ({ id: row.id, label: row.name })),
    (item) => {
      const playlist = rows.find((row) => row.id === item.id);
      if (playlist === undefined) return null;
      if (verb === "sync") return syncSkip(playlist, jobFor[playlist.id]);
      if (verb === "enable") return playlist.enabled ? ALREADY_ENABLED : null;
      if (verb === "disable") return playlist.enabled ? null : ALREADY_DISABLED;
      return null;
    },
  );
}

/** Why a verb is disabled, or undefined: nothing ticked, a run going, the backend unreachable, or nothing left to run
 *  (Enable and Disable say every ticked row is already so; Sync now gives the first skipped row's reason). */
export function playlistVerbReason(
  verb: PlaylistBulkVerb,
  plan: BulkPlan<number>,
  tickedCount: number,
  state: { readonly busy: boolean; readonly unreachable: boolean },
): string | undefined {
  if (tickedCount === 0) return TICK_FIRST;
  if (state.busy) return WORKING_REASON;
  if (state.unreachable) return UNREACHABLE_REASON;
  if (plan.runnable.length > 0) return undefined;
  if (verb === "enable") return EVERY_PLAYLIST_ENABLED;
  if (verb === "disable") return EVERY_PLAYLIST_DISABLED;
  return plan.refused[0]?.reason;
}
