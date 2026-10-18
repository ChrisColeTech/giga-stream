import { UNREACHABLE_REASON } from "@/constants/account-copy";
import {
  NOT_RUNNING_REASON, RUNNING_REASON, RUN_PLAYLIST_OFF, RUN_RUNNING, SAVE_JOB_FIRST, STOPPING_REASON,
} from "@/constants/job-copy";
import { TICK_JOB_FIRST } from "@/constants/record-copy";
import type { AdminJob } from "@/services/schemas/job-schema";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { playlistIdOf } from "./job-rows";

/* Why `Run job` cannot run (`38` section 4.2), pure, in this priority order: nothing ticked, a ticked job already
 * running (a job's own Enabled switch gates only its schedule, never a manual run), a ticked job's playlist disabled,
 * the backend unreachable. The playlist is found by the
 * job's own `playlistId` in the playlists list, then by its `playlistName`. */

/** The playlist a job syncs, from the held list, or undefined (a catalog job, or a list not read). */
export function playlistOfJob(job: AdminJob, playlists: readonly AdminPlaylist[]): AdminPlaylist | undefined {
  const id = playlistIdOf(job);
  if (id === null) return undefined;
  return playlists.find((one) => one.id === id) ?? playlists.find((one) => one.name === job.playlistName);
}

export function runGate(
  ticked: readonly AdminJob[],
  playlists: readonly AdminPlaylist[],
  unreachable: boolean,
): string | undefined {
  if (ticked.length === 0) return TICK_JOB_FIRST;
  if (ticked.some((job) => job.running)) return RUN_RUNNING;
  if (ticked.some((job) => playlistOfJob(job, playlists)?.enabled === false)) return RUN_PLAYLIST_OFF;
  return unreachable ? UNREACHABLE_REASON : undefined;
}

/** The workspace's `Run job`: the toolbar's reasons for this one job, after `Save the job first` while the draft is
 *  dirty and `Running.` while its own call runs. */
export function workspaceRunReason(
  job: AdminJob,
  state: {
    readonly dirty: boolean;
    readonly busy: boolean;
    readonly unreachable: boolean;
    readonly playlists: readonly AdminPlaylist[];
  },
): string | undefined {
  if (state.dirty) return SAVE_JOB_FIRST;
  if (state.busy || job.running) return RUNNING_REASON;
  return runGate([job], state.playlists, state.unreachable);
}

/** The workspace's `Stop` (`43` section 3.4a): enabled only while the job runs; `Stopping.` while its own call runs. */
export function workspaceStopReason(job: AdminJob, busy: boolean): string | undefined {
  if (busy) return STOPPING_REASON;
  return job.running ? undefined : NOT_RUNNING_REASON;
}
