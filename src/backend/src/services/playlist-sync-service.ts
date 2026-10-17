import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import { PLAYLIST_SYNC_EXAMPLES_MAX } from "../constants/limits.js";
import type { ChannelRecord } from "../store/channel-repository.js";
import type { Store } from "../store/store.js";
import type { BackendChannel } from "../types/channel.js";
import type { PlaylistSyncAnswer, PlaylistSyncCounts, PlaylistSyncStatus } from "../types/playlist-sync.js";
import type { Actor, AuditService } from "./audit-service.js";
import { httpsLogoUrl, type LogoResolver } from "./logo-resolver.js";
import type { M3uEntry } from "./m3u-parser.js";
import { fetchPlaylist } from "./playlist-fetch.js";

/**
 * The playlist sync (docs/03 section 7.2c): each configured playlist is fetched once, parsed, run
 * through the address rule (https only — refusals are skipped and counted, never imported broken),
 * matched against the rows the sync owns (the same host first, then tvgId, then exact name), and
 * written in one transaction with one revision bump, which readers see in their next channel read. Hand-created
 * rows (`source` absent) are never matched, updated or removed. Single flight: a second start is
 * `409 playlist.busy`. Every run — manual, dry or scheduled — is one `channel.imported` audit entry.
 */
export function createPlaylistSyncService(deps: {
  store: Store;
  audit: AuditService;
  logos: LogoResolver;
  playlistUrls: string[];
  maxBytes: number;
  maxEntries: number;
  allowLoopback: boolean;
  fetchImpl?: typeof fetch;
  now: () => number;
}) {
  const { store, audit, logos, playlistUrls, maxBytes, maxEntries, allowLoopback, now } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;

  let running: { startedAt: number } | null = null;
  let last: { finishedAt: number; outcome: string; counts?: PlaylistSyncCounts } | null = null;

  function auditSafe(actor: Actor, detail: Record<string, unknown>): void {
    try {
      audit.record(actor, { action: "channel.imported", subject: "channels", detail });
    } catch {
      // a shutdown between the guard and the write; the entry is lost, not the process
    }
  }

  async function performRun(options: { dryRun: boolean; prune: boolean }, actor: Actor, hosts: string[]): Promise<PlaylistSyncAnswer> {
    let skipped = 0;
    let refused = 0;
    const refusalExamples: string[] = [];
    const usable: Array<{ host: string; entry: M3uEntry }> = [];
    for (const url of playlistUrls) {
      const playlist = await fetchPlaylist({ url, maxBytes, maxEntries, allowLoopback, fetchImpl });
      hosts.push(playlist.host);
      skipped += playlist.skipped;
      refused += playlist.refused;
      refusalExamples.push(...playlist.refusalExamples);
      for (const entry of playlist.entries) usable.push({ host: playlist.host, entry });
    }
    refusalExamples.length = Math.min(refusalExamples.length, PLAYLIST_SYNC_EXAMPLES_MAX);

    // Enrichment: an entry's own logo always wins; a miss leaves the row with no logo.
    for (const { entry } of usable) {
      entry.logoUrl = httpsLogoUrl(entry.logoUrl) ?? httpsLogoUrl(await logos.resolve(entry.name, entry.tvgId));
    }

    const owned = store.channels.list().filter((channel) => channel.source !== undefined);
    const byHost = new Map<string, BackendChannel[]>();
    for (const channel of owned) {
      const rows = byHost.get(channel.source ?? "");
      if (rows === undefined) byHost.set(channel.source ?? "", [channel]);
      else rows.push(channel);
    }
    const used = new Set<string>();
    const findMatch = (entry: M3uEntry, host: string): BackendChannel | undefined => {
      for (const pool of [byHost.get(host) ?? [], owned]) {
        if (entry.tvgId !== undefined) {
          const byId = pool.find((c) => !used.has(c.id) && c.tvgId === entry.tvgId);
          if (byId !== undefined) return byId;
        }
        const byName = pool.find((c) => !used.has(c.id) && c.name === entry.name);
        if (byName !== undefined) return byName;
      }
      return undefined;
    };

    const creates: Array<{ host: string; record: Omit<ChannelRecord, "revision"> }> = [];
    const updates: ChannelRecord[] = [];
    for (const { host, entry } of usable) {
      const match = findMatch(entry, host);
      if (match === undefined) {
        const record: Omit<ChannelRecord, "revision"> = {
          id: `ch_${randomUUID()}`, name: entry.name, category: entry.groupTitle ?? "", number: entry.number ?? null,
          logoUrl: entry.logoUrl ?? null, tvgId: entry.tvgId ?? null, source: host, streamUrl: entry.streamUrl,
        };
        creates.push({ host, record });
        continue;
      }
      used.add(match.id);
      const record: ChannelRecord = {
        id: match.id, name: match.name, category: entry.groupTitle ?? match.category,
        number: entry.number ?? match.number ?? null, logoUrl: entry.logoUrl ?? match.logoUrl ?? null,
        tvgId: match.tvgId ?? null, source: match.source ?? null, streamUrl: entry.streamUrl, revision: 0,
      };
      const changed = record.streamUrl !== match.streamUrl || record.logoUrl !== (match.logoUrl ?? null) ||
        record.category !== match.category || record.number !== (match.number ?? null);
      if (changed) updates.push(record);
    }
    const vanished = owned.filter((c) => c.source !== undefined && hosts.includes(c.source) && !used.has(c.id));
    const counts: PlaylistSyncCounts = { created: creates.length, updated: updates.length, skipped, refused, removed: vanished.length };
    if (!options.dryRun && counts.created + counts.updated + counts.removed > 0) {
      store.transaction(() => {
        const next = store.revisions.next();
        for (const { record } of creates) store.channels.insert({ ...record, revision: next }, now());
        for (const record of updates) store.channels.update({ ...record, revision: next });
        if (options.prune) for (const channel of vanished) store.channels.remove(channel.id);
      });
    }
    auditSafe(actor, { ...counts, hosts, dryRun: options.dryRun, prune: options.prune });
    return {
      ...counts,
      refusalExamples,
      createdIds: options.dryRun ? [] : creates.slice(0, PLAYLIST_SYNC_EXAMPLES_MAX).map((c) => c.record.id),
    };
  }

  return {
    isRunning: (): boolean => running !== null,

    /** One run; the route awaits it, so the answer is this run's counts. A second start is `409`. */
    async run(options: { dryRun?: boolean; prune?: boolean }, actor: Actor): Promise<PlaylistSyncAnswer> {
      if (running !== null) throw new AppError(ERRORS.playlistBusy, { startedAt: running.startedAt });
      running = { startedAt: now() };
      const hosts: string[] = [];
      try {
        const answer = await performRun({ dryRun: options.dryRun ?? false, prune: options.prune ?? false }, actor, hosts);
        last = {
          finishedAt: now(),
          outcome: "ok",
          counts: { created: answer.created, updated: answer.updated, skipped: answer.skipped, refused: answer.refused, removed: answer.removed },
        };
        return answer;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "failed";
        last = { finishedAt: now(), outcome: message };
        auditSafe(actor, { failed: message, ...(hosts.length > 0 && { hosts }) });
        throw error;
      } finally {
        running = null;
      }
    },

    status(): Omit<PlaylistSyncStatus, "schedule"> {
      return {
        running: running !== null,
        ...(running !== null && { startedAt: running.startedAt }),
        ...(last !== null && { lastRunAt: last.finishedAt, lastOutcome: last.outcome, ...(last.counts && { counts: last.counts }) }),
        playlists: playlistUrls,
      };
    },
  };
}

export type PlaylistSyncService = ReturnType<typeof createPlaylistSyncService>;
