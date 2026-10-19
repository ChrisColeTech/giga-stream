import { AppError, ERRORS } from "../constants/errors.js";
import { ADDRESS_MAX } from "../constants/limits.js";
import { isUniqueViolation } from "../store/database.js";
import type { PlaylistRecord } from "../store/playlist-repository.js";
import type { Store } from "../store/store.js";
import type { PlaylistDeleted, PlaylistPatch, PlaylistView } from "../types/playlist.js";
import { addressRefusal, isAcceptedAddress } from "./address-rule.js";
import type { Actor, AuditService } from "./audit-service.js";
import type { JobRunner } from "./job-runner.js";
import { playlistView } from "./playlist-view.js";

const invalid = (field: string, message: string): AppError => new AppError(ERRORS.playlistInvalid, { field }, message);

/**
 * The playlists after they exist (docs/43 sections 3.1 and 3.2): read, rename, enable, rotate a web playlist's address,
 * delete. The address can carry credentials in its query: a signed-in admin reads it in full, but an audit entry
 * holds the host alone. A playlist's `enabled` is part of what a public reader sees, so
 * changing it takes a revision. Deleting a playlist aborts its running sync, waits for it, and removes the playlist
 * together with its channels and sync job through the foreign keys, in one transaction. `onChange` re-arms the
 * scheduler.
 */
export function createPlaylistService(deps: {
  store: Store;
  audit: AuditService;
  runner: Pick<JobRunner, "stop">;
  onChange: () => void;
}) {
  const { store, audit, runner, onChange } = deps;

  async function existing(id: number): Promise<PlaylistRecord> {
    const found = await store.playlists.find(id);
    if (!found) throw new AppError(ERRORS.playlistNotFound, { id });
    return found;
  }

  /** The new address of a web playlist: the rule, and not held by another playlist. */
  async function checkedUrl(current: PlaylistRecord, raw: string): Promise<{ url: string; host: string }> {
    if (current.kind !== "url") throw invalid("url", "A file playlist has no web address. Import the file again.");
    const url = raw.trim();
    if (url.length > ADDRESS_MAX || !isAcceptedAddress(url)) {
      throw invalid("url", addressRefusal("playlist address"));
    }
    const holder = await store.playlists.idOfUrl(url);
    if (holder !== undefined && holder !== current.id) throw new AppError(ERRORS.playlistTaken, { field: "url" });
    return { url, host: new URL(url).host };
  }

  return {
    list: async (): Promise<{ items: PlaylistView[] }> => {
      const counts = await store.channels.countsByPlaylist();
      return { items: await Promise.all((await store.playlists.list()).map((playlist) => playlistView(store, playlist, counts))) };
    },

    get: async (id: number): Promise<PlaylistView> => playlistView(store, await existing(id)),

    update: async (id: number, patch: PlaylistPatch, actor: Actor): Promise<PlaylistView> => {
      const current = await existing(id);
      const name = patch.name ?? current.name;
      const holder = await store.playlists.idOfName(name);
      if (holder !== undefined && holder !== id) throw new AppError(ERRORS.playlistTaken, { field: "name" });
      const address = patch.url === undefined ? undefined : await checkedUrl(current, patch.url);
      const enabled = patch.enabled ?? current.enabled;
      try {
        await store.transaction(async () => {
          await store.playlists.update({
            id, name, enabled,
            ...(current.kind === "url" && { url: address?.url ?? current.url ?? "", host: address?.host ?? current.host ?? "" }),
          });
          if (enabled !== current.enabled) await store.revisions.next();
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError(ERRORS.playlistTaken);
        throw error;
      }
      await audit.record(actor, {
        action: "playlist.updated",
        subject: String(id),
        detail: { name, fields: Object.keys(patch), host: address?.host ?? current.host ?? current.fileName },
      });
      if (enabled !== current.enabled) onChange();
      return playlistView(store, await existing(id));
    },

    remove: async (id: number, actor: Actor): Promise<PlaylistDeleted> => {
      const current = await existing(id);
      const job = await store.jobs.findOfPlaylist(id);
      if (job) await runner.stop(job.id);
      const answer = await store.transaction(async () => {
        const deletedChannels = (await store.channels.countsByPlaylist()).get(id)?.channels ?? 0;
        const deletedJobs = await store.jobs.countOfPlaylist(id);
        await store.playlists.remove(id);
        await store.revisions.next();
        await audit.record(actor, {
          action: "playlist.deleted",
          subject: String(id),
          detail: { channels: deletedChannels, jobs: deletedJobs, host: current.host ?? current.fileName },
        });
        return { id, deletedChannels, deletedJobs };
      });
      onChange();
      return answer;
    },
  };
}

export type PlaylistService = ReturnType<typeof createPlaylistService>;
