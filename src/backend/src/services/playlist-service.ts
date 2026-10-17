import { AppError, ERRORS } from "../constants/errors.js";
import { ADDRESS_MAX, PLAYLISTS_MAX } from "../constants/limits.js";
import type { PlaylistRecord } from "../store/playlist-repository.js";
import type { Store } from "../store/store.js";
import type { PlaylistInput, PlaylistPatch, PlaylistView } from "../types/playlist.js";
import { addressRefusal, isAcceptedAddress } from "./address-rule.js";
import type { Actor, AuditService } from "./audit-service.js";
import { maskedHost } from "./playlist-ref.js";

const invalid = (field: string, message: string): AppError => new AppError(ERRORS.playlistInvalid, { field }, message);

/**
 * The playlists (docs/26 section 3.11): records with a name, an address and `Enabled`. The address is a secret - it
 * can carry credentials in its query - so no answer shows it (only `host` and `masked`), an audit entry holds the
 * host alone, and `https` only is accepted (docs/03 section 7.3). Deleting a playlist keeps the channels it created
 * and releases them: they lose their `source` and become hand-made rows no sync touches again; the jobs that
 * synced the playlist go with it. `onChange` re-arms the scheduler when `enabled` changes.
 */
export function createPlaylistService(deps: {
  store: Store;
  audit: AuditService;
  now: () => number;
  allowLoopback: boolean;
  onChange: () => void;
}) {
  const { store, audit, now, allowLoopback, onChange } = deps;

  const viewOf = (p: PlaylistRecord): PlaylistView => ({
    id: p.id,
    name: p.name,
    host: p.host,
    masked: maskedHost(p.host),
    enabled: p.enabled,
    channels: store.channels.countOfPlaylist(p.id),
    ...(p.lastSyncedAt !== undefined && { lastSyncedAt: p.lastSyncedAt }),
    ...(p.lastOutcome !== undefined && { lastOutcome: p.lastOutcome }),
  });

  function existing(id: number): PlaylistRecord {
    const found = store.playlists.find(id);
    if (!found) throw new AppError(ERRORS.playlistNotFound, { id });
    return found;
  }

  /** The address rule, and that it is not listed already; answers its host. */
  function checkAddress(address: string, ownId?: number): string {
    const trimmed = address.trim();
    if (trimmed.length > ADDRESS_MAX || !isAcceptedAddress(trimmed, allowLoopback)) {
      throw invalid("address", addressRefusal("playlist address", allowLoopback));
    }
    const holder = store.playlists.idOfAddress(trimmed);
    if (holder !== undefined && holder !== ownId) throw invalid("address", "That playlist is already listed.");
    return new URL(trimmed).host;
  }

  return {
    list: (): { items: PlaylistView[] } => ({ items: store.playlists.list().map(viewOf) }),

    get: (id: number): PlaylistView => viewOf(existing(id)),

    create(input: PlaylistInput, actor: Actor): PlaylistView {
      if (store.playlists.list().length >= PLAYLISTS_MAX) throw invalid("address", `At most ${PLAYLISTS_MAX} playlists can be listed.`);
      const host = checkAddress(input.address);
      const id = store.playlists.insert(
        { name: input.name ?? host, address: input.address.trim(), host, enabled: input.enabled ?? true },
        now(),
      );
      audit.record(actor, { action: "playlist.created", subject: String(id), detail: { host } });
      return viewOf(existing(id));
    },

    update(id: number, patch: PlaylistPatch, actor: Actor): PlaylistView {
      const current = existing(id);
      const address = patch.address === undefined ? current.address : patch.address.trim();
      const host = patch.address === undefined ? current.host : checkAddress(address, id);
      const next = { id, name: patch.name ?? current.name, address, host, enabled: patch.enabled ?? current.enabled };
      store.playlists.update(next);
      audit.record(actor, {
        action: "playlist.updated",
        subject: String(id),
        detail: { fields: Object.keys(patch), host },
      });
      if (next.enabled !== current.enabled) onChange();
      return viewOf(existing(id));
    },

    remove(id: number, actor: Actor): { id: number; released: number } {
      const current = existing(id);
      const released = store.channels.countOfPlaylist(id);
      store.transaction(() => {
        if (released > 0) store.channels.detachPlaylist(id, store.revisions.next());
        store.jobs.removeOfPlaylist(id);
        store.playlists.remove(id);
      });
      audit.record(actor, { action: "playlist.deleted", subject: String(id), detail: { host: current.host, released } });
      onChange();
      return { id, released };
    },
  };
}

export type PlaylistService = ReturnType<typeof createPlaylistService>;
