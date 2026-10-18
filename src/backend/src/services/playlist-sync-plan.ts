import { NOT_SYNCED, type StreamRecord } from "../types/channel.js";
import type { M3uEntry } from "./m3u-parser.js";

/** What a playlist's entries change in that playlist's own rows: new rows, and rows that take new values. */
export interface EntryPlan {
  creates: StreamRecord[];
  updates: StreamRecord[];
}

/**
 * A matched row takes the entry's values except the fields an admin edited (docs/26 section 3.10); the display name
 * is never overwritten, neither is `enabled`, and the playlist's own name for the entry (`syncName`) follows the
 * entry. Without an edit the entry wins: its address always, its category and logo whenever it has them.
 */
export function mergeEntry(match: StreamRecord, entry: M3uEntry): StreamRecord {
  const edited = new Set(match.editedFields);
  return {
    ...match,
    syncName: entry.name,
    streamUrl: edited.has("streamUrl") ? match.streamUrl : entry.streamUrl,
    category: edited.has("category") ? match.category : (entry.groupTitle ?? match.category),
    logoUrl: edited.has("logoUrl") ? match.logoUrl : (entry.logoUrl ?? match.logoUrl),
  };
}

const sameValues = (a: StreamRecord, b: StreamRecord): boolean =>
  a.streamUrl === b.streamUrl && a.logoUrl === b.logoUrl && a.category === b.category && a.syncName === b.syncName;

type KeyOf<T> = (value: T) => string;

/**
 * One matching pass over the entries and rows nobody has taken yet. A candidate is a row with the same key; with
 * `exact` the first one is taken (identical rows are interchangeable), otherwise only an unambiguous pair matches:
 * one row and one entry for that key, or - when the key is shared - the one row whose `tvgId` equals the entry's.
 */
function pass(
  pending: M3uEntry[],
  rows: StreamRecord[],
  taken: Set<string>,
  matches: Map<M3uEntry, StreamRecord>,
  keys: { entry: KeyOf<M3uEntry>; row: KeyOf<StreamRecord> },
  exact: boolean,
): void {
  const entriesPerKey = new Map<string, number>();
  const left = pending.filter((entry) => !matches.has(entry));
  for (const entry of left) entriesPerKey.set(keys.entry(entry), (entriesPerKey.get(keys.entry(entry)) ?? 0) + 1);
  const byKey = new Map<string, StreamRecord[]>();
  for (const row of rows) {
    if (!taken.has(row.id)) byKey.set(keys.row(row), [...(byKey.get(keys.row(row)) ?? []), row]);
  }
  for (const entry of left) {
    const candidates = (byKey.get(keys.entry(entry)) ?? []).filter((row) => !taken.has(row.id));
    let chosen: StreamRecord | undefined = candidates[0];
    if (!exact) {
      const alone = candidates.length === 1 && entriesPerKey.get(keys.entry(entry)) === 1;
      const byTvg = entry.tvgId === undefined ? [] : candidates.filter((row) => row.tvgId === entry.tvgId);
      chosen = alone ? candidates[0] : byTvg.length === 1 ? byTvg[0] : undefined;
    }
    if (chosen === undefined) continue;
    taken.add(chosen.id);
    matches.set(entry, chosen);
  }
}

/**
 * Decides what a playlist's entries do to that playlist's own rows (docs/43 section 3.6), with no side effect. Three
 * passes over the rows not yet used: the exact `(syncName, streamUrl)`, then the name alone when it is unambiguous (a
 * moved address), then the address alone (a renamed entry). Nothing in another playlist, and nothing hand-made, is
 * ever a candidate; no row is ever deleted. A new entry becomes a disabled row.
 */
export function planEntries(input: {
  rows: StreamRecord[];
  entries: M3uEntry[];
  playlistId: number;
  newId: () => string;
}): EntryPlan {
  const { rows, entries, playlistId, newId } = input;
  const taken = new Set<string>();
  const matches = new Map<M3uEntry, StreamRecord>();
  const nameOf: KeyOf<StreamRecord> = (row) => row.syncName ?? row.name;
  pass(entries, rows, taken, matches, { entry: (e) => `${e.name}\n${e.streamUrl}`, row: (r) => `${nameOf(r)}\n${r.streamUrl}` }, true);
  pass(entries, rows, taken, matches, { entry: (e) => e.name, row: nameOf }, false);
  pass(entries, rows, taken, matches, { entry: (e) => e.streamUrl, row: (r) => r.streamUrl }, false);

  const plan: EntryPlan = { creates: [], updates: [] };
  for (const entry of entries) {
    const match = matches.get(entry);
    if (match === undefined) {
      plan.creates.push({
        ...NOT_SYNCED,
        kind: "stream", id: newId(), name: entry.name, category: entry.groupTitle ?? "", number: entry.number ?? null,
        logoUrl: entry.logoUrl ?? null, tvgId: entry.tvgId ?? null, streamUrl: entry.streamUrl, syncName: entry.name,
        playlistId, editedFields: [], enabled: false, published: false, revision: 0,
      });
      continue;
    }
    const merged = mergeEntry(match, entry);
    if (!sameValues(merged, match)) plan.updates.push(merged);
  }
  return plan;
}
