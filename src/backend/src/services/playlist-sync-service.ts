import { randomUUID } from "node:crypto";

import { AppError, ERRORS } from "../constants/errors.js";
import { PLAYLIST_SYNC_EXAMPLES_MAX } from "../constants/limits.js";
import type { PlaylistRecord } from "../store/playlist-repository.js";
import type { Store } from "../store/store.js";
import type { PlaylistSyncAnswer, PlaylistSyncCounts, PlaylistSyncStatus } from "../types/playlist-sync.js";
import type { Actor, AuditService } from "./audit-service.js";
import { withoutQuery } from "./address-rule.js";
import { httpsLogoUrl, type LogoResolver } from "./logo-resolver.js";
import { fetchPlaylist } from "./playlist-fetch.js";
import { playlistRefOf } from "./playlist-ref.js";
import { type PlannedEntry, planSync } from "./playlist-sync-plan.js";

/**
 * The playlist sync (docs/03 section 7.2c, docs/26 section 3.10): each configured playlist is fetched once,
 * parsed, run through the address rule (https only - refusals are skipped and counted, never imported broken),
 * matched against the rows the sync owns (the same host first, then tvgId, then the playlist's own name), and
 * written in one transaction with one revision bump, which readers see in their next channel read. A match takes
 * the entry's values except the fields an admin edited; `prune` never deletes an edited row (`kept`). Hand-created rows (`source` absent) are never matched, updated or removed. Single flight:
 * a second start is `409 playlist.busy`. Every run - manual, dry or scheduled - is one `channel.imported` audit entry.
 */
export function createPlaylistSyncService(deps: {
  store: Store;
  audit: AuditService;
  logos: LogoResolver;
  maxBytes: number;
  maxEntries: number;
  allowLoopback: boolean;
  fetchImpl?: typeof fetch;
  now: () => number;
}) {
  const { store, audit, logos, maxBytes, maxEntries, allowLoopback, now } = deps;
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

  async function performRun(
    options: { dryRun: boolean; prune: boolean },
    actor: Actor,
    hosts: string[],
    targets: PlaylistRecord[],
  ): Promise<PlaylistSyncAnswer> {
    let skipped = 0;
    let refused = 0;
    const refusalExamples: string[] = [];
    const usable: PlannedEntry[] = [];
    for (const target of targets) {
      const playlist = await fetchPlaylist({ url: target.address, maxBytes, maxEntries, allowLoopback, fetchImpl });
      hosts.push(playlist.host);
      skipped += playlist.skipped;
      refused += playlist.refused;
      refusalExamples.push(...playlist.refusalExamples);
      for (const entry of playlist.entries) usable.push({ host: playlist.host, playlistId: target.id, entry });
    }
    refusalExamples.length = Math.min(refusalExamples.length, PLAYLIST_SYNC_EXAMPLES_MAX);

    // Enrichment: an entry's own logo always wins; a miss leaves the row with no logo.
    for (const { entry } of usable) {
      const logo = httpsLogoUrl(entry.logoUrl) ?? httpsLogoUrl(await logos.resolve(entry.name, entry.tvgId));
      entry.logoUrl = logo === undefined ? undefined : withoutQuery(logo);
    }

    const plan = planSync({
      owned: store.channels.listSynced(),
      usable,
      hosts,
      newId: () => `ch_${randomUUID()}`,
    });
    const { creates, updates, vanished } = plan;
    const counts: PlaylistSyncCounts = {
      created: creates.length,
      updated: updates.length,
      skipped,
      refused,
      removed: vanished.length,
      kept: plan.kept.length,
    };
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

    /**
     * One run over `targets` (default: every enabled playlist, read from the store now); the route awaits it, so the
     * answer is this run's counts. A second start is `409`. Each playlist in the run keeps how it went.
     */
    async run(options: { dryRun?: boolean; prune?: boolean }, actor: Actor, targets?: PlaylistRecord[]): Promise<PlaylistSyncAnswer> {
      if (running !== null) throw new AppError(ERRORS.playlistBusy, { startedAt: running.startedAt });
      running = { startedAt: now() };
      const hosts: string[] = [];
      const list = targets ?? store.playlists.list().filter((p) => p.enabled);
      const remember = (outcome: string): void => {
        for (const p of list) if (store.playlists.find(p.id)) store.playlists.recordSync(p.id, now(), outcome);
      };
      try {
        const answer = await performRun({ dryRun: options.dryRun ?? false, prune: options.prune ?? false }, actor, hosts, list);
        const { created, updated, skipped, refused, removed, kept } = answer;
        last = { finishedAt: now(), outcome: "ok", counts: { created, updated, skipped, refused, removed, kept } };
        remember("ok");
        return answer;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "failed";
        last = { finishedAt: now(), outcome: message };
        remember(message);
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
        playlists: store.playlists.list().map(playlistRefOf),
      };
    },
  };
}

export type PlaylistSyncService = ReturnType<typeof createPlaylistSyncService>;
