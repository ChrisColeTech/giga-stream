import type { StreamRecord } from "../types/channel.js";
import type { M3uEntry } from "./m3u-parser.js";

export interface SyncPlan {
  creates: Array<{ host: string; record: Omit<StreamRecord, "revision"> }>;
  updates: StreamRecord[];
  /** Sync-owned rows whose entry has gone and that no admin edited: what `prune` may delete. */
  vanished: StreamRecord[];
  /** Sync-owned rows whose entry has gone but that an admin edited: `prune` never deletes them (rule 3). */
  kept: StreamRecord[];
}

/** One playlist entry with the playlist record it came from. */
export interface PlannedEntry {
  host: string;
  playlistId: number;
  entry: M3uEntry;
}

/**
 * A matched row takes the entry's values except the fields an admin edited (rule 1); the display name is never
 * overwritten, and neither is `enabled`: a disabled row stays disabled and is still updated otherwise. Without an
 * edit the entry wins, as it always did: its address always, its category, number and logo whenever it has one.
 */
export function mergeEntry(match: StreamRecord, entry: M3uEntry, playlistId: number): StreamRecord {
  const edited = new Set(match.editedFields);
  return {
    ...match,
    streamUrl: edited.has("streamUrl") ? match.streamUrl : entry.streamUrl,
    category: edited.has("category") ? match.category : (entry.groupTitle ?? match.category),
    number: edited.has("number") ? match.number : (entry.number ?? match.number),
    logoUrl: edited.has("logoUrl") ? match.logoUrl : (entry.logoUrl ?? match.logoUrl),
    playlistId,
    revision: 0,
  };
}

const sameValues = (a: StreamRecord, b: StreamRecord): boolean =>
  a.streamUrl === b.streamUrl && a.logoUrl === b.logoUrl && a.category === b.category && a.number === b.number
  && a.playlistId === b.playlistId;

/**
 * Decides one run, with no side effect: which entries create a row, which update one, and which sync-owned rows
 * have no entry any more. Entries match the rows of their own host first and then every sync-owned row, by tvg-id
 * and then by the playlist's own name (`syncName`, rule 2), never by the display name. Only the hosts of the
 * playlists in this run can lose a row to `prune`.
 */
export function planSync(input: {
  owned: StreamRecord[];
  usable: PlannedEntry[];
  hosts: string[];
  newId: () => string;
}): SyncPlan {
  const { owned, usable, hosts, newId } = input;
  const byHost = new Map<string, StreamRecord[]>();
  for (const channel of owned) {
    const rows = byHost.get(channel.source ?? "");
    if (rows === undefined) byHost.set(channel.source ?? "", [channel]);
    else rows.push(channel);
  }
  const used = new Set<string>();
  const findMatch = (entry: M3uEntry, host: string): StreamRecord | undefined => {
    for (const pool of [byHost.get(host) ?? [], owned]) {
      if (entry.tvgId !== undefined) {
        const byId = pool.find((c) => !used.has(c.id) && c.tvgId === entry.tvgId);
        if (byId !== undefined) return byId;
      }
      const byName = pool.find((c) => !used.has(c.id) && (c.syncName ?? c.name) === entry.name);
      if (byName !== undefined) return byName;
    }
    return undefined;
  };

  const plan: SyncPlan = { creates: [], updates: [], vanished: [], kept: [] };
  for (const { host, entry, playlistId } of usable) {
    const match = findMatch(entry, host);
    if (match === undefined) {
      plan.creates.push({
        host,
        record: {
          kind: "stream", id: newId(), name: entry.name, category: entry.groupTitle ?? "", number: entry.number ?? null,
          logoUrl: entry.logoUrl ?? null, tvgId: entry.tvgId ?? null, source: host, streamUrl: entry.streamUrl,
          syncName: entry.name, playlistId, editedFields: [], enabled: true,
        },
      });
      continue;
    }
    used.add(match.id);
    const merged = mergeEntry(match, entry, playlistId);
    if (!sameValues(merged, match)) plan.updates.push(merged);
  }
  for (const channel of owned) {
    if (channel.source === null || !hosts.includes(channel.source) || used.has(channel.id)) continue;
    (channel.editedFields.length > 0 ? plan.kept : plan.vanished).push(channel);
  }
  return plan;
}
