import { AppError, ERRORS } from "../constants/errors.js";
import { ADDRESS_MAX, PLAYLISTS_MAX } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import type { PlaylistRef } from "../types/playlist-sync.js";
import { addressRefusal, isAcceptedAddress } from "./address-rule.js";
import type { Actor, AuditService } from "./audit-service.js";
import { playlistRefOf } from "./playlist-ref.js";
import { formatSchedule, parseSchedule } from "./title-shapes.js";

export interface SyncSettingsView {
  titleSchedule: string;
  playlistSchedule: string;
  playlistUrls: PlaylistRef[];
}

/** The two timers an admin's change re-arms (`armSchedule` and `clearSchedule` already exist on each). */
export interface ScheduleTargets {
  titles: { armSchedule(ms: number): void; disarmSchedule(): void };
  playlists: { armSchedule(ms: number): void; clearSchedule(): void };
}

const invalid = (field: string, message: string): AppError => new AppError(ERRORS.settingsInvalid, { field }, message);

/** A schedule as stored: `"6h"`, `"90m"`, or `"off"`; anything `parseSchedule` refuses is `settings.invalid`. */
function normalised(value: string, field: string): string {
  let ms: number | undefined;
  try {
    ms = parseSchedule(value, field);
  } catch {
    throw invalid(field, 'The schedule must be a number and a unit (500ms, 45s, 30m, 6h), or "off".');
  }
  return formatSchedule(ms);
}

/**
 * The sync settings (docs/26 section 3.11): the two schedules and the playlist addresses are stored and editable.
 * The environment seeds a key on the first start only; after that the stored value wins. A change re-arms or clears
 * its scheduler at once; a playlist schedule with no playlists stays unarmed (docs/03 section 7.2c). An address can
 * carry credentials in its query, so no read returns it and an audit entry holds the host only.
 */
export function createSyncSettings(deps: {
  store: Store;
  audit: AuditService;
  now: () => number;
  allowLoopback: boolean;
  /** Whether TMDB has a token: the catalog sync's schedule is armed only then. */
  tmdbConfigured: boolean;
  seed: { titleSchedule: string; playlistSchedule: string; playlistUrls: string[] };
  targets: ScheduleTargets;
}) {
  const { store, audit, now, allowLoopback, targets } = deps;
  const settings = store.syncSettings;

  // First start only: a key that is already stored is never read from the environment again.
  if (!settings.has("title_schedule")) settings.set("title_schedule", normalised(deps.seed.titleSchedule, "TMDB_SYNC_SCHEDULE"), now());
  if (!settings.has("playlist_schedule")) {
    settings.set("playlist_schedule", normalised(deps.seed.playlistSchedule, "PLAYLIST_SYNC_SCHEDULE"), now());
  }
  if (!settings.has("playlist_urls")) {
    settings.setPlaylists(deps.seed.playlistUrls.map((url, index) => ({ id: index + 1, url })), now());
    settings.set("playlist_next_id", String(deps.seed.playlistUrls.length + 1), now());
  }

  const titleSchedule = (): string => settings.get("title_schedule") ?? "off";
  const playlistSchedule = (): string => settings.get("playlist_schedule") ?? "off";

  function applyTitleSchedule(): void {
    const ms = parseSchedule(titleSchedule());
    if (ms !== undefined && deps.tmdbConfigured) targets.titles.armSchedule(ms);
    else targets.titles.disarmSchedule();
  }

  function applyPlaylistSchedule(): void {
    const ms = parseSchedule(playlistSchedule());
    if (ms !== undefined && settings.playlists().length > 0) targets.playlists.armSchedule(ms);
    else targets.playlists.clearSchedule();
  }

  const view = (): SyncSettingsView => ({
    titleSchedule: titleSchedule(),
    playlistSchedule: playlistSchedule(),
    playlistUrls: settings.playlists().map(playlistRefOf),
  });

  return {
    view,
    titleSchedule,
    playlistSchedule,

    /** The start: arm what the stored settings say. */
    applySchedules(): void {
      applyTitleSchedule();
      applyPlaylistSchedule();
    },

    update(patch: { titleSchedule?: string; playlistSchedule?: string }, actor: Actor): SyncSettingsView {
      const next: Record<string, string> = {};
      if (patch.titleSchedule !== undefined) next.titleSchedule = normalised(patch.titleSchedule, "titleSchedule");
      if (patch.playlistSchedule !== undefined) next.playlistSchedule = normalised(patch.playlistSchedule, "playlistSchedule");
      const titleChanged = next.titleSchedule !== undefined && next.titleSchedule !== titleSchedule();
      const playlistChanged = next.playlistSchedule !== undefined && next.playlistSchedule !== playlistSchedule();
      if (titleChanged) settings.set("title_schedule", next.titleSchedule ?? "off", now());
      if (playlistChanged) settings.set("playlist_schedule", next.playlistSchedule ?? "off", now());
      if (titleChanged) applyTitleSchedule();
      if (playlistChanged) applyPlaylistSchedule();
      if (titleChanged || playlistChanged) {
        audit.record(actor, {
          action: "settings.sync_updated",
          subject: "sync-settings",
          detail: {
            ...(titleChanged && { titleSchedule: next.titleSchedule }),
            ...(playlistChanged && { playlistSchedule: next.playlistSchedule }),
          },
        });
      }
      return view();
    },

    addPlaylist(url: string, actor: Actor): PlaylistRef {
      const trimmed = url.trim();
      if (trimmed.length > ADDRESS_MAX || !isAcceptedAddress(trimmed, allowLoopback)) {
        throw invalid("url", addressRefusal("playlist address", allowLoopback));
      }
      const current = settings.playlists();
      if (current.length >= PLAYLISTS_MAX) throw invalid("url", `At most ${PLAYLISTS_MAX} playlists can be listed.`);
      if (current.some((p) => p.url === trimmed)) throw invalid("url", "That playlist is already listed.");
      const id = Number(settings.get("playlist_next_id") ?? current.length + 1);
      settings.setPlaylists([...current, { id, url: trimmed }], now());
      settings.set("playlist_next_id", String(id + 1), now());
      const ref = playlistRefOf({ id, url: trimmed });
      audit.record(actor, { action: "settings.playlist_added", subject: String(id), detail: { host: ref.host } });
      if (current.length === 0) applyPlaylistSchedule(); // the schedule was waiting for its first playlist
      return ref;
    },

    removePlaylist(id: number, actor: Actor): { id: number } {
      const current = settings.playlists();
      const found = current.find((p) => p.id === id);
      if (found === undefined) throw new AppError(ERRORS.settingsPlaylistNotFound, { id });
      settings.setPlaylists(current.filter((p) => p.id !== id), now());
      audit.record(actor, { action: "settings.playlist_removed", subject: String(id), detail: { host: playlistRefOf(found).host } });
      if (current.length === 1) applyPlaylistSchedule(); // none left: the schedule goes unarmed
      return { id };
    },
  };
}

export type SyncSettings = ReturnType<typeof createSyncSettings>;
