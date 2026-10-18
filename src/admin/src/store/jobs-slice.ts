import { pruneIds, upsertById, withTick, withoutId } from "@/lib/playlist-rows";
import type { AdminJob } from "@/services/schemas/job-schema";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import type { SliceGet, SliceSet } from "./slices/slice-host";

/* The Jobs tab's data, a slice of the one store (`38` section 6). Facts only: no promise, no timer. `running` is the
 * job's own flag as the last read or write answered it (no polling: a catalog run's end is learnt on a Refresh). The
 * statusbar's `N syncing` is the count of running jobs; the jobs flows write it with `setWork` after every load and
 * write that lands here (a tab slice reaches only its own fields, `39` section 5). `playlists` is the playlist list the New
 * form's select and the `Run job` gate read, through the service, never the Playlists slice. `session` is the sign-in
 * serial the data belongs to: the load hook resets the slice when a new session starts. */

export type JobsStatus = "idle" | "loading" | "ready" | "failed";

export interface JobsState {
  readonly status: JobsStatus;
  readonly items: readonly AdminJob[];
  readonly unreachable: boolean;
  readonly ticked: readonly number[];
  readonly playlists: readonly AdminPlaylist[];
  readonly playlistsStatus: JobsStatus;
  readonly session: number;
}

export const NO_JOBS: JobsState = {
  status: "idle",
  items: [],
  unreachable: false,
  ticked: [],
  playlists: [],
  playlistsStatus: "idle",
  session: 0,
};

export interface JobsSlice {
  jobs: JobsState;
  jobsReset: (session: number) => void;
  jobsStartLoad: () => void;
  /** A read answered: the items replace the old, `unreachable` clears, gone rows lose their ticks. */
  jobsLoaded: (items: readonly AdminJob[]) => void;
  jobsLoadFailed: (unreachable: boolean) => void;
  /** The playlists for the select and the gate; `null` when that read failed (the last list stays). */
  jobsPlaylistsLoaded: (playlists: readonly AdminPlaylist[] | null) => void;
  jobUpsert: (job: AdminJob) => void;
  jobRemove: (id: number) => void;
  jobTick: (id: number, on: boolean) => void;
  jobsTickAll: (on: boolean) => void;
  jobsSetTicked: (ids: readonly number[]) => void;
  jobsMarkUnreachable: (unreachable: boolean) => void;
}

export function createJobsSlice(set: SliceSet<JobsSlice>, get: SliceGet<JobsSlice>): JobsSlice {
  const patch = (next: Partial<JobsState>): void => set({ jobs: { ...get().jobs, ...next } });
  const withItems = (items: readonly AdminJob[]): Partial<JobsState> => ({
    items,
    ticked: pruneIds(get().jobs.ticked, items),
  });
  return {
    jobs: NO_JOBS,
    jobsReset: (session) => set({ jobs: { ...NO_JOBS, session } }),
    jobsStartLoad: () => patch({ status: "loading", playlistsStatus: "loading" }),
    jobsLoaded: (items) => patch({ status: "ready", unreachable: false, ...withItems(items) }),
    jobsLoadFailed: (unreachable) => patch({ status: "failed", unreachable }),
    jobsPlaylistsLoaded: (playlists) =>
      patch(playlists === null ? { playlistsStatus: "failed" } : { playlists, playlistsStatus: "ready" }),
    jobUpsert: (job) => patch(withItems(upsertById(get().jobs.items, job))),
    jobRemove: (id) => patch(withItems(withoutId(get().jobs.items, id))),
    jobTick: (id, on) => patch({ ticked: withTick(get().jobs.ticked, id, on) }),
    jobsTickAll: (on) => patch({ ticked: on ? get().jobs.items.map((item) => item.id) : [] }),
    jobsSetTicked: (ids) => patch({ ticked: pruneIds(ids, get().jobs.items) }),
    jobsMarkUnreachable: (unreachable) => patch({ unreachable }),
  };
}
