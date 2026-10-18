import { EVENT_LOG_LIMIT, type EventRow } from "@giga/ui/lib/event-log";
import type { AuditEntry } from "@/types/admin-audit";
import type { EventArea } from "@/types/events";
import { eventFromAudit, type SubjectNames } from "./event-sentence";

/* Audit pages into the drawer's rows (`29` section 11), pure. The backend answers newest first; the drawer keeps oldest
 * first with the newest at the foot, so a page is reversed. An audit row has the id `audit-<id>`; the page's own `say`
 * rows keep their ids and interleave by time. */

const PREFIX = "audit-";

type Row = EventRow<EventArea>;
export type MergeMode = "reload" | "older";

function auditId(row: Row): number | null {
  if (!row.id.startsWith(PREFIX)) return null;
  const id = Number(row.id.slice(PREFIX.length));
  return Number.isFinite(id) ? id : null;
}

/** The smallest audit id held: `Load older` asks for the entries before it. Null when no audit row is held. */
export function oldestAuditId(rows: readonly Row[]): number | null {
  const ids = rows.map(auditId).filter((id): id is number => id !== null);
  return ids.length === 0 ? null : Math.min(...ids);
}

function byTime(a: Row, b: Row): number {
  if (a.at !== b.at) return a.at - b.at;
  const left = auditId(a);
  const right = auditId(b);
  return left !== null && right !== null ? left - right : 0;
}

/** The held rows plus a page (newest first). A row already held (same id) is replaced by the page's copy; time order is
 *  kept; over the cap a reload drops the oldest rows, while `Load older` drops the newest, since it was asked for the
 *  past and a reload brings the present back. */
export function mergeAudit(
  held: readonly Row[],
  page: readonly AuditEntry[],
  names: SubjectNames,
  mode: MergeMode,
): readonly Row[] {
  const incoming = page.map((entry) => eventFromAudit(entry, names));
  const ids = new Set(incoming.map((row) => row.id));
  const merged = [...held.filter((row) => !ids.has(row.id)), ...incoming].sort(byTime);
  if (merged.length <= EVENT_LOG_LIMIT) return merged;
  return mode === "older" ? merged.slice(0, EVENT_LOG_LIMIT) : merged.slice(-EVENT_LOG_LIMIT);
}
