import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

import { runInTransaction } from "./database.js";

const UrlRow = z.object({ stream_url: z.string() });
const LogoRow = z.object({ logo_url: z.string(), logo_file: z.string().nullable(), logo_checked_at: z.number().nullable() });
const NameRow = z.object({ sync_name: z.string(), tvg_id: z.string().nullable(), edited_fields: z.string().nullable() });
const FileRow = z.object({ logo_file: z.string() });

export interface Verdict {
  url: string;
  status: "online" | "offline";
  at: number;
}
export interface LogoTarget {
  url: string;
  file: string | null;
  checkedAt: number | null;
}
export interface NameToResolve {
  syncName: string;
  tvgId: string | null;
}

/** An admin edit of the logo address is kept: the sync never fills in or replaces it (docs/26 section 3.10). */
const editsLogo = (json: string | null): boolean => json !== null && json.includes('"logoUrl"');

/**
 * The sync's targeted writes to the sync-owned columns (docs/43 sections 3.3 and 3.4): `status`, `checked_at`,
 * `logo_file`, `logo_checked_at`, and the one `logo_url` fill-in. Each statement names the playlist and the value it
 * expects (`stream_url` or `logo_url`), so a row edited or deleted mid-run no longer matches and is skipped. The
 * verdict and cache writes take no revision and leave a row's `revision` alone: they are admin-only. The channel
 * repository's whole-row `update` never writes these columns.
 */
export function createChannelHealth(db: DatabaseSync) {
  const urls = db.prepare(`
    SELECT stream_url FROM channels WHERE playlist_id = ? AND kind = 'stream'
    GROUP BY stream_url ORDER BY MIN(checked_at IS NOT NULL), MIN(checked_at), MIN(id)`);
  const setStatus = db.prepare("UPDATE channels SET status = ?, checked_at = ? WHERE playlist_id = ? AND stream_url = ?");
  const logos = db.prepare(`
    SELECT logo_url, logo_file, logo_checked_at FROM channels
    WHERE playlist_id = ? AND kind = 'stream' AND logo_url IS NOT NULL
    GROUP BY logo_url, logo_file, logo_checked_at ORDER BY logo_checked_at IS NOT NULL, logo_checked_at, logo_url`);
  const setLogo = db.prepare("UPDATE channels SET logo_file = ?, logo_checked_at = ? WHERE playlist_id = ? AND logo_url = ?");
  const setLogoChecked = db.prepare("UPDATE channels SET logo_checked_at = ? WHERE playlist_id = ? AND logo_url = ?");
  const files = db.prepare("SELECT DISTINCT logo_file FROM channels WHERE logo_file IS NOT NULL");
  const unresolved = db.prepare(`
    SELECT sync_name, MIN(tvg_id) AS tvg_id, MIN(edited_fields) AS edited_fields FROM channels
    WHERE playlist_id = ? AND kind = 'stream' AND logo_url IS NULL AND sync_name IS NOT NULL GROUP BY sync_name`);
  const fill = db.prepare(`
    UPDATE channels SET logo_url = ? WHERE playlist_id = ? AND sync_name = ? AND logo_url IS NULL
      AND (edited_fields IS NULL OR edited_fields NOT LIKE '%"logoUrl"%')`);

  return {
    /** This playlist's distinct stream addresses, never-checked first, then the longest unchecked (a total order). */
    streamUrls: (playlistId: number): string[] => urls.all(playlistId).map((row) => UrlRow.parse(row).stream_url),

    /** Verdicts, written in batches inside one transaction each; answers the rows that still matched. */
    writeVerdicts(playlistId: number, batch: readonly Verdict[]): number {
      return runInTransaction(db, () => {
        let matched = 0;
        for (const v of batch) matched += Number(setStatus.run(v.status, v.at, playlistId, v.url).changes);
        return matched;
      });
    },

    /** Each distinct (address, cached file, last check) of this playlist's logos. */
    logoTargets: (playlistId: number): LogoTarget[] =>
      logos.all(playlistId).map((row) => {
        const r = LogoRow.parse(row);
        return { url: r.logo_url, file: r.logo_file, checkedAt: r.logo_checked_at };
      }),

    cacheLogo: (playlistId: number, url: string, file: string, at: number): void =>
      void setLogo.run(file, at, playlistId, url),

    /** A failed download stamps the check time only; a cached copy from before is kept. */
    stampLogo: (playlistId: number, url: string, at: number): void => void setLogoChecked.run(at, playlistId, url),

    /** Every cache file some channel references: the end-of-run collection keeps these. */
    referencedLogoFiles: (): Set<string> => new Set(files.all().map((row) => FileRow.parse(row).logo_file)),

    /** The names (with a tvg id) of this playlist's rows that have no logo address and no admin-edited one. */
    namesWithoutLogo: (playlistId: number): NameToResolve[] =>
      unresolved.all(playlistId).map((row) => NameRow.parse(row))
        .filter((r) => !editsLogo(r.edited_fields))
        .map((r) => ({ syncName: r.sync_name, tvgId: r.tvg_id })),

    /** Fills missing logo addresses in one transaction; answers how many rows changed. */
    fillLogoUrls(playlistId: number, found: ReadonlyMap<string, string>, takeRevision: () => void): number {
      return runInTransaction(db, () => {
        let changed = 0;
        for (const [syncName, url] of found) changed += Number(fill.run(url, playlistId, syncName).changes);
        if (changed > 0) takeRevision();
        return changed;
      });
    },
  };
}

export type ChannelHealth = ReturnType<typeof createChannelHealth>;
