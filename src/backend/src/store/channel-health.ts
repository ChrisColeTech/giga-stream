import { z } from "zod";

import { runInTransaction, type Database } from "./database.js";

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

const SQL = {
  urls: `
    SELECT stream_url FROM channels WHERE playlist_id = ? AND kind = 'stream'
    GROUP BY stream_url ORDER BY MIN(checked_at IS NOT NULL), MIN(checked_at), MIN(id)`,
  setStatus: "UPDATE channels SET status = ?, checked_at = ? WHERE playlist_id = ? AND stream_url = ?",
  logos: `
    SELECT logo_url, logo_file, logo_checked_at FROM channels
    WHERE playlist_id = ? AND kind = 'stream' AND logo_url IS NOT NULL
    GROUP BY logo_url, logo_file, logo_checked_at ORDER BY logo_checked_at IS NOT NULL, logo_checked_at, logo_url`,
  setLogo: "UPDATE channels SET logo_file = ?, logo_checked_at = ? WHERE playlist_id = ? AND logo_url = ?",
  setLogoChecked: "UPDATE channels SET logo_checked_at = ? WHERE playlist_id = ? AND logo_url = ?",
  files: "SELECT DISTINCT logo_file FROM channels WHERE logo_file IS NOT NULL",
  unresolved: `
    SELECT sync_name, MIN(tvg_id) AS tvg_id, MIN(edited_fields) AS edited_fields FROM channels
    WHERE playlist_id = ? AND kind = 'stream' AND logo_url IS NULL AND sync_name IS NOT NULL GROUP BY sync_name`,
  fill: `
    UPDATE channels SET logo_url = ? WHERE playlist_id = ? AND sync_name = ? AND logo_url IS NULL
      AND (edited_fields IS NULL OR edited_fields NOT LIKE '%"logoUrl"%')`,
};

/**
 * The sync's targeted writes to the sync-owned columns (docs/43 sections 3.3 and 3.4): `status`, `checked_at`,
 * `logo_file`, `logo_checked_at`, and the one `logo_url` fill-in. Each statement names the playlist and the value it
 * expects (`stream_url` or `logo_url`), so a row edited or deleted mid-run no longer matches and is skipped. The
 * verdict and cache writes take no revision and leave a row's `revision` alone: they are admin-only. The channel
 * repository's whole-row `update` never writes these columns.
 */
export function createChannelHealth(db: Database) {
  return {
    /** This playlist's distinct stream addresses, never-checked first, then the longest unchecked (a total order). */
    streamUrls: async (playlistId: number): Promise<string[]> =>
      (await db.execute({ sql: SQL.urls, args: [playlistId] })).rows.map((row) => UrlRow.parse(row).stream_url),

    /** Verdicts, written in batches inside one transaction each; answers the rows that still matched. */
    writeVerdicts(playlistId: number, batch: readonly Verdict[]): Promise<number> {
      return runInTransaction(db, async (txn) => {
        let matched = 0;
        for (const v of batch) {
          matched += (await txn.execute({ sql: SQL.setStatus, args: [v.status, v.at, playlistId, v.url] })).rowsAffected;
        }
        return matched;
      });
    },

    /** Each distinct (address, cached file, last check) of this playlist's logos. */
    logoTargets: async (playlistId: number): Promise<LogoTarget[]> =>
      (await db.execute({ sql: SQL.logos, args: [playlistId] })).rows.map((row) => {
        const r = LogoRow.parse(row);
        return { url: r.logo_url, file: r.logo_file, checkedAt: r.logo_checked_at };
      }),

    cacheLogo: async (playlistId: number, url: string, file: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.setLogo, args: [file, at, playlistId, url] });
    },

    /** A failed download stamps the check time only; a cached copy from before is kept. */
    stampLogo: async (playlistId: number, url: string, at: number): Promise<void> => {
      await db.execute({ sql: SQL.setLogoChecked, args: [at, playlistId, url] });
    },

    /** Every cache file some channel references: the end-of-run collection keeps these. */
    referencedLogoFiles: async (): Promise<Set<string>> =>
      new Set((await db.execute(SQL.files)).rows.map((row) => FileRow.parse(row).logo_file)),

    /** The names (with a tvg id) of this playlist's rows that have no logo address and no admin-edited one. */
    namesWithoutLogo: async (playlistId: number): Promise<NameToResolve[]> =>
      (await db.execute({ sql: SQL.unresolved, args: [playlistId] })).rows.map((row) => NameRow.parse(row))
        .filter((r) => !editsLogo(r.edited_fields))
        .map((r) => ({ syncName: r.sync_name, tvgId: r.tvg_id })),

    /** Fills missing logo addresses in one transaction; answers how many rows changed. */
    fillLogoUrls(
      playlistId: number,
      found: ReadonlyMap<string, string>,
      takeRevision: () => Promise<unknown>,
    ): Promise<number> {
      return runInTransaction(db, async (txn) => {
        let changed = 0;
        for (const [syncName, url] of found) {
          changed += (await txn.execute({ sql: SQL.fill, args: [url, playlistId, syncName] })).rowsAffected;
        }
        if (changed > 0) await takeRevision();
        return changed;
      });
    },
  };
}

export type ChannelHealth = ReturnType<typeof createChannelHealth>;
