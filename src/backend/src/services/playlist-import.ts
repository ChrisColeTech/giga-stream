import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import { ADDRESS_MAX } from "../constants/limits.js";
import { isUniqueViolation } from "../store/database.js";
import type { PlaylistRecord } from "../store/playlist-repository.js";
import type { Store } from "../store/store.js";
import type { ImportAnswer, ImportCounts, PlaylistInput } from "../types/playlist.js";
import { addressRefusal, isAcceptedAddress } from "./address-rule.js";
import type { Actor, AuditService } from "./audit-service.js";
import { nameOfUrl, sanitizeFileName, uniqueName } from "./playlist-names.js";
import { screenPlaylist, type ScreenedPlaylist } from "./playlist-entries.js";
import { fetchPlaylistText } from "./playlist-source.js";
import { planEntries } from "./playlist-sync-plan.js";
import { playlistView } from "./playlist-view.js";
import { applyPlan } from "./playlist-writes.js";
import type { SafeFetch } from "./safe-fetch.js";

const invalid = (field: string, message: string): AppError => new AppError(ERRORS.playlistInvalid, { field }, message);

/** Where an import came from: an uploaded file (already sanitised) or a web address (already accepted). */
type Origin =
  | { kind: "file"; fileName: string }
  | { kind: "url"; url: string; host: string; name?: string; enabled: boolean };

/** What re-reading a web playlist did to its channels (the sync job's step 2). */
export interface RefreshResult {
  source: "unchanged" | "updated" | "unreachable";
  counts: ImportCounts;
}

/**
 * The playlist import (docs/43 section 3.2). Order, for both a file and a web address: read and parse first, with no
 * database write; then ONE synchronous transaction does the duplicate check, the playlist insert (a file whose name
 * exists updates that playlist in place), the channel plan and writes, the playlist's sync job, one revision bump only
 * if a row changed, and one `playlist.imported` audit entry. The `UNIQUE` columns decide a concurrent double import:
 * the loser is `409 playlist.taken`. `onChange` runs after the commit, so the new job arms.
 */
export function createPlaylistImporter(deps: {
  store: Store;
  audit: AuditService;
  now: () => number;
  maxBytes: number;
  maxEntries: number;
  safeFetch: SafeFetch;
  onChange: () => void;
}) {
  const { store, audit, now, maxBytes, maxEntries, safeFetch, onChange } = deps;
  const newId = (): string => `ch_${randomUUID()}`;

  /** Creates (or, for a known file, updates) the playlist and its channels; the caller wraps it in the transaction. */
  function write(origin: Origin, screened: ScreenedPlaylist, actor: Actor): ImportAnswer {
    const held = origin.kind === "file" ? store.playlists.idOfFileName(origin.fileName) : store.playlists.idOfUrl(origin.url);
    if (held !== undefined && origin.kind === "url") throw new AppError(ERRORS.playlistTaken, { field: "url" });
    let playlistId = held;
    if (playlistId === undefined) {
      const typed = origin.kind === "url" ? origin.name : undefined;
      if (typed !== undefined && store.playlists.idOfName(typed) !== undefined) {
        throw new AppError(ERRORS.playlistTaken, { field: "name" });
      }
      const derived = origin.kind === "file" ? origin.fileName : nameOfUrl(new URL(origin.url));
      const name = typed ?? uniqueName(derived, (candidate) => store.playlists.idOfName(candidate) !== undefined);
      playlistId =
        origin.kind === "file"
          ? store.playlists.insert({ kind: "file", name, fileName: origin.fileName, enabled: true }, now())
          : store.playlists.insert({ kind: "url", name, url: origin.url, host: origin.host, enabled: origin.enabled }, now());
      store.jobs.insertPlaylist(playlistId, now());
    }
    const rows = held === undefined ? [] : store.channels.listOfPlaylist(playlistId);
    const plan = planEntries({ rows, entries: screened.entries, playlistId, newId });
    applyPlan(store, plan, now());
    const counts = { created: plan.creates.length, updated: plan.updates.length, skipped: screened.skipped, refused: screened.refused };
    const imported: ImportCounts = { ...counts, refusalExamples: screened.refusalExamples };
    audit.record(actor, {
      action: "playlist.imported",
      subject: String(playlistId),
      detail: { ...counts, kind: origin.kind, source: origin.kind === "file" ? origin.fileName : origin.host },
    });
    const record = store.playlists.find(playlistId);
    if (!record) throw new AppError(ERRORS.playlistNotFound, { id: playlistId });
    return { ...playlistView(store, record), created: held === undefined, imported };
  }

  function commit(origin: Origin, screened: ScreenedPlaylist, actor: Actor): ImportAnswer {
    try {
      const answer = store.transaction(() => write(origin, screened, actor));
      onChange();
      return answer;
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError(ERRORS.playlistTaken);
      throw error;
    }
  }

  const screen = (text: string): ScreenedPlaylist => screenPlaylist(text, { maxEntries });

  return {
    maxBytes,

    /** An uploaded file: the name is sanitised, the body parsed, and nothing is stored but the channels. */
    importFile(upload: { fileName: string; body: Buffer }, actor: Actor): ImportAnswer {
      const fileName = sanitizeFileName(upload.fileName);
      if (fileName === undefined) throw invalid("file", "The file must be an .m3u or .m3u8 playlist with a name.");
      return commit({ kind: "file", fileName }, screen(new TextDecoder().decode(upload.body)), actor);
    },

    /** A web address: checked, fetched once through the guarded fetch, parsed, then written. */
    async importUrl(input: PlaylistInput, actor: Actor): Promise<ImportAnswer> {
      const url = input.url.trim();
      if (url.length > ADDRESS_MAX || !isAcceptedAddress(url)) {
        throw invalid("url", addressRefusal("playlist address"));
      }
      const screened = screen(await fetchPlaylistText(safeFetch, url, { maxBytes }));
      return commit({ kind: "url", url, host: new URL(url).host, enabled: input.enabled ?? true, ...(input.name && { name: input.name }) }, screened, actor);
    },

    /**
     * The sync job's step 2 for a web playlist: fetch again and import what is new (create and update, never delete).
     * A fetch that fails, or a body that is no longer a playlist, is `unreachable` and writes nothing.
     */
    async refresh(playlist: PlaylistRecord, signal: AbortSignal): Promise<RefreshResult> {
      const none = { created: 0, updated: 0, skipped: 0, refused: 0, refusalExamples: [] };
      if (playlist.url === undefined) return { source: "unchanged", counts: none };
      let screened: ScreenedPlaylist;
      try {
        screened = screen(await fetchPlaylistText(safeFetch, playlist.url, { maxBytes, signal }));
      } catch (error) {
        if (error instanceof AppError) return { source: "unreachable", counts: none };
        throw error;
      }
      const plan = store.transaction(() => {
        if (!store.playlists.find(playlist.id)) return undefined;
        const made = planEntries({ rows: store.channels.listOfPlaylist(playlist.id), entries: screened.entries, playlistId: playlist.id, newId });
        return applyPlan(store, made, now()) ? made : { creates: [], updates: [] };
      });
      const counts = {
        created: plan?.creates.length ?? 0, updated: plan?.updates.length ?? 0, skipped: screened.skipped,
        refused: screened.refused, refusalExamples: screened.refusalExamples,
      };
      return { source: counts.created + counts.updated > 0 ? "updated" : "unchanged", counts };
    },
  };
}

export type PlaylistImporter = ReturnType<typeof createPlaylistImporter>;
