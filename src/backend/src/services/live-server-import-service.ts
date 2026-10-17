import type { LiveRecord } from "../types/channel.js";
import { readExistingIdentities, readLegacyChannels } from "../store/live-server-import.js";
import { createStore } from "../store/store.js";

export interface ImportSkip {
  id: string;
  reason: string;
}

export interface ImportSummary {
  /** The ids written (or, in a dry run, the ids that would be). */
  inserted: string[];
  skipped: ImportSkip[];
  dryRun: boolean;
}

/**
 * Which of the old live server's channels go in: those whose id is free and whose number no live row holds.
 * Pure, so a dry run and the real run agree. A channel already imported is skipped, which makes it idempotent.
 */
export function planImport(
  legacy: LiveRecord[],
  existing: { ids: Set<string>; liveNumbers: Map<string, string> },
): { insert: LiveRecord[]; skipped: ImportSkip[] } {
  const insert: LiveRecord[] = [];
  const skipped: ImportSkip[] = [];
  const takenNumbers = new Map(existing.liveNumbers);
  for (const record of legacy) {
    const holder = record.number === null ? undefined : takenNumbers.get(record.number);
    if (existing.ids.has(record.id)) skipped.push({ id: record.id, reason: "already in the backend" });
    else if (holder !== undefined) skipped.push({ id: record.id, reason: `number ${record.number} is held by ${holder}` });
    else {
      insert.push(record);
      if (record.number !== null) takenNumbers.set(record.number, record.id);
    }
  }
  return { insert, skipped };
}

/**
 * The one-shot import of an existing `live-server.db` into the backend's database (docs/26 decision D13): each
 * channel becomes a `kind: live` row through the store, in one transaction, with an audit entry. It never runs
 * at server start; the owner runs `scripts/import-live-server-db.ts`. `dryRun` reads both databases and writes
 * nothing (it does not even migrate the target).
 */
export function runLiveServerImport(options: {
  source: string;
  target: string;
  dryRun: boolean;
  now: () => number;
}): ImportSummary {
  const { source, target, dryRun, now } = options;
  const plan = planImport(readLegacyChannels(source), readExistingIdentities(target));
  if (!dryRun && plan.insert.length > 0) {
    const store = createStore(target);
    try {
      store.transaction(() => {
        for (const record of plan.insert) {
          store.channels.insert({ ...record, revision: store.revisions.next() }, now());
          store.audit.append(
            { action: "channel.imported", subject: record.id, detail: { name: record.name, from: "live-server.db" } },
            now(),
          );
        }
      });
    } finally {
      store.close();
    }
  }
  return { inserted: plan.insert.map((record) => record.id), skipped: plan.skipped, dryRun };
}
