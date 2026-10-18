import { AUDIT_AFTER_WRITE, AUDIT_PAGE } from "@/constants/audit-limits";
import {
  PLAYLIST_GONE,
  SYNC_NO_JOB,
  playlistCreated,
  playlistDeleted,
  playlistSaved,
  unreadablePlaylists,
} from "@/constants/playlist-copy";
import type { BulkItem } from "@/lib/bulk-plan";
import { jobForPlaylists, type PlaylistBulkVerb } from "@/lib/playlist-bulk";
import { changedFields, createBody, isEmptyPatch } from "@/lib/playlist-body";
import {
  firstRefusal, newAddressOf, type NewPlaylistDraft, type PlaylistDraft, type PlaylistField,
} from "@/lib/playlist-draft";
import {
  BAD_ANSWER, DROPPED, codeOf, done, fieldOf, isUnreachable, sentenceOf, type FlowRefused, type FlowResult,
} from "@/lib/playlist-flow-result";
import { findById } from "@/lib/playlist-rows";
import type { AppState } from "@/store/app-store";
import type { JobsService } from "./jobs";
import type { PlaylistsService } from "./playlists";
import type { AdminPlaylist } from "./schemas/playlist-schema";

/** The part of the store the flows read and write; `useAppStore.getState` satisfies it, a test passes the same. */
export type PlaylistStore = Pick<
  AppState,
  | "serial" | "signedIn" | "playlists" | "workspaces" | "playlistsStartLoad" | "playlistsLoaded"
  | "playlistsLoadFailed" | "playlistUpsert" | "playlistRemove" | "playlistsMarkUnreachable" | "closeWorkspace" | "markStale" | "say"
>;

export interface PlaylistFlowDeps {
  readonly service: Pick<PlaylistsService, "list" | "create" | "update" | "remove">;
  /** The jobs service: its list for `Sync now`'s reasons, its `run` for `Sync now` itself. Never the Jobs slice. */
  readonly jobs: Pick<JobsService, "list" | "run">;
  readonly store: () => PlaylistStore;
  readonly audit: { readonly reload: (limit?: number) => Promise<void> };
}

export type PlaylistResult<T = undefined> = FlowResult<T, PlaylistField>;

export interface PlaylistFlows {
  load: () => Promise<PlaylistResult>;
  refresh: () => Promise<PlaylistResult>;
  create: (draft: NewPlaylistDraft) => Promise<PlaylistResult>;
  save: (id: number, draft: PlaylistDraft) => Promise<PlaylistResult<AdminPlaylist | null>>;
  remove: (id: number) => Promise<PlaylistResult>;
  /** One bulk verb's single-record call (`39` section 6): null on success, the failure's sentence otherwise. Delete
   *  adds each answer's `released` to `tally`. */
  bulkCall: (verb: PlaylistBulkVerb, tally: { released: number }) => (item: BulkItem<number>) => Promise<string | null>;
}

const FIELDS: readonly PlaylistField[] = ["name", "address", "enabled"];

/** The Playlists tab's orchestration (`38` section 3). Each flow records the session's serial before it awaits and
 *  writes only if the session is unchanged after; a failure is said once as a `warn` notice and returned typed, so the
 *  form puts a field's refusal under its row. The address goes to the service and nowhere else: never a notice, the store or an
 *  error of this module (the backend's sentence for a bad address does not repeat it). */
export function createPlaylistFlows(deps: PlaylistFlowDeps): PlaylistFlows {
  const { service, jobs, store, audit } = deps;
  const alive = (serial: number): boolean => store().signedIn && store().serial === serial;
  const say = (sentence: string): void => store().say(sentence, "info", "Playlist");

  const refuse = (sentence: string, field?: PlaylistField): FlowRefused<PlaylistField> => {
    store().say(sentence, "warn", "Playlist");
    return { ok: false, sentence, ...(field !== undefined && { field }) };
  };
  const refused = (error: unknown): FlowRefused<PlaylistField> => {
    if (isUnreachable(error)) store().playlistsMarkUnreachable(true);
    return refuse(sentenceOf(error), fieldOf(error, FIELDS));
  };
  /** A write whose answer could not be read may still have happened: read the list again. */
  const failed = (error: unknown): FlowRefused<PlaylistField> => {
    const result = refused(error);
    if (codeOf(error) === BAD_ANSWER) void load();
    return result;
  };

  async function load(): Promise<PlaylistResult> {
    if (store().playlists.status === "loading") return done(undefined);
    const serial = store().serial;
    store().playlistsStartLoad();
    const [list, jobList] = await Promise.allSettled([service.list(), jobs.list()]);
    if (!alive(serial)) return DROPPED;
    if (list.status === "rejected") {
      store().playlistsLoadFailed(isUnreachable(list.reason));
      return refused(list.reason);
    }
    const jobFor = jobList.status === "fulfilled" ? jobForPlaylists(jobList.value.items) : store().playlists.jobFor;
    store().playlistsLoaded(list.value.items, jobFor);
    if (list.value.unreadable > 0) store().say(unreadablePlaylists(list.value.unreadable), "warn", "Playlist");
    return done(undefined);
  }

  async function create(draft: NewPlaylistDraft): Promise<PlaylistResult> {
    const bad = firstRefusal(draft.name, draft.address);
    if (bad !== null) return refuse(bad.sentence, bad.field);
    const serial = store().serial;
    try {
      const playlist = await service.create(createBody(draft));
      if (!alive(serial)) return DROPPED;
      store().playlistUpsert(playlist);
      store().markStale("jobs");
      say(playlistCreated(playlist.name));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      return alive(serial) ? failed(error) : DROPPED;
    }
  }

  function gone(): FlowRefused<PlaylistField> {
    store().closeWorkspace("playlists");
    void load();
    return refuse(PLAYLIST_GONE);
  }

  async function save(id: number, draft: PlaylistDraft): Promise<PlaylistResult<AdminPlaylist | null>> {
    const saved = findById(store().playlists.items, id);
    if (saved === undefined) return gone();
    const patch = changedFields(saved, draft);
    if (isEmptyPatch(patch)) return done(null);
    const bad = firstRefusal(draft.name, newAddressOf(draft));
    if (bad !== null) return refuse(bad.sentence, bad.field);
    const serial = store().serial;
    try {
      const playlist = await service.update(id, patch);
      if (!alive(serial)) return DROPPED;
      store().playlistUpsert(playlist);
      store().markStale("jobs");
      say(playlistSaved(playlist.name));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(playlist);
    } catch (error: unknown) {
      if (!alive(serial)) return DROPPED;
      return codeOf(error) === "playlist.not_found" ? gone() : failed(error);
    }
  }

  async function remove(id: number): Promise<PlaylistResult> {
    const playlist = findById(store().playlists.items, id);
    if (playlist === undefined) return gone();
    const serial = store().serial;
    try {
      const answer = await service.remove(id);
      if (!alive(serial)) return DROPPED;
      store().playlistRemove(id);
      if (store().workspaces.playlists === String(id)) store().closeWorkspace("playlists");
      store().markStale("jobs");
      store().markStale("channels");
      say(playlistDeleted(playlist.name, answer.released));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      if (!alive(serial)) return DROPPED;
      if (codeOf(error) === "playlist.not_found") store().playlistRemove(id);
      return failed(error);
    }
  }

  const bulkCall: PlaylistFlows["bulkCall"] = (verb, tally) => async (item) => {
    try {
      if (verb === "delete") {
        tally.released += (await service.remove(item.id)).released;
        store().playlistRemove(item.id);
      } else if (verb === "sync") {
        const link = store().playlists.jobFor[item.id];
        if (link === undefined) return SYNC_NO_JOB;
        await jobs.run(link.id);
      } else {
        store().playlistUpsert(await service.update(item.id, { enabled: verb === "enable" }));
      }
      return null;
    } catch (error: unknown) {
      if (isUnreachable(error)) store().playlistsMarkUnreachable(true);
      return sentenceOf(error);
    }
  };

  const refresh = async (): Promise<PlaylistResult> => {
    const [result] = await Promise.all([load(), audit.reload(AUDIT_PAGE)]);
    return result;
  };

  return { load, refresh, create, save, remove, bulkCall };
}
