import type { EventRow } from "@giga/ui/lib/event-log";
import { eventFromAudit } from "@/lib/event-sentence";
import type { AuditEntry } from "@/types/admin-audit";
import type { EventArea } from "@/types/events";

/* The audit-style history the Events drawer starts with, and the older pages `Load older` adds: the mockup's
 * `js/event-log.js` rows as the backend's own entry shape (`29` section 5), so wiring replaces the source and not the
 * shape. Example hosts only. Deleted by `29` (Wave 7). */

const at = (day: number, hour: number, minute: number, second: number): number =>
  Date.UTC(2026, 9, day, hour, minute, second);

const ADA = "ada@example.test";
const ED = "ed@example.test";

/** The older rows, oldest first; `Load older` prepends a page of them at a time. */
export const OLDER_AUDIT: readonly AuditEntry[] = [
  { id: 1, at: at(15, 9, 0, 12), action: "auth.login", actorEmail: ADA },
  { id: 2, at: at(15, 12, 5, 0), action: "auth.login_failed", detail: { email: ED } },
  { id: 3, at: at(15, 16, 18, 31), action: "channel.deleted", actorEmail: ADA, detail: { name: "Old Test Channel" } },
  { id: 4, at: at(15, 16, 20, 9), action: "provider.created", actorEmail: ADA, detail: { name: "VidZee" } },
  { id: 5, at: at(16, 9, 30, 0), action: "job.ran", actorEmail: ADA, detail: { name: "Sync IPTV main" } },
  { id: 6, at: at(16, 10, 2, 44), action: "account.created", actorEmail: ADA, detail: { name: ED } },
  { id: 7, at: at(16, 17, 38, 50), action: "auth.login", actorEmail: ED },
  { id: 8, at: at(16, 17, 40, 11), action: "channel.updated", actorEmail: ED, detail: { name: "Fixture Music" } },
];

const FAILED_BUILD = "Fixture Movies failed to build: the folder has no videos";
const FAILED_SYNC = "Job Popular series failed: TMDB is unavailable";

/** The recent rows, oldest first: what the drawer holds when the page opens. */
export const RECENT_AUDIT: readonly AuditEntry[] = [
  { id: 9, at: at(17, 9, 12, 3), action: "auth.login", actorEmail: ADA },
  { id: 10, at: at(17, 9, 14, 2), action: "channel.created", actorEmail: ADA, detail: { name: "Fixture Sports" } },
  {
    id: 11,
    at: at(17, 9, 15, 21),
    action: "channel.rebuilt",
    actorEmail: ADA,
    detail: { name: "Fixture Movies", outcome: FAILED_BUILD },
  },
  { id: 12, at: at(17, 9, 20, 15), action: "channel.updated", actorEmail: ADA, detail: { name: "Fixture News" } },
  { id: 13, at: at(17, 9, 24, 40), action: "provider.updated", actorEmail: ADA, detail: { name: "Cinezo" } },
  { id: 14, at: at(17, 9, 31, 8), action: "title.updated", actorEmail: ED, detail: { title: "Inception" } },
  { id: 15, at: at(17, 9, 36, 52), action: "playlist.created", actorEmail: ADA, detail: { host: "IPTV main" } },
  { id: 16, at: at(17, 9, 40, 0), action: "job.ran", actorEmail: ADA, detail: { name: "Trending movies" } },
  { id: 17, at: at(17, 9, 41, 19), action: "sync.finished", detail: { outcome: FAILED_SYNC } },
  { id: 18, at: at(17, 9, 48, 33), action: "auth.login_failed", detail: { email: "eve@example.test" } },
  { id: 19, at: at(17, 9, 51, 40), action: "account.updated", actorEmail: ADA, detail: { name: ED } },
  { id: 20, at: at(17, 9, 52, 10), action: "account.updated", actorEmail: ADA, detail: { name: "eve@example.test" } },
];

/** The two rows that are not the audit log's: the page's own (a connection, a channel still preparing). */
export const PAGE_EVENTS: readonly EventRow<EventArea>[] = [
  {
    id: "page-connected",
    at: at(17, 9, 10, 58),
    tone: "info",
    area: "Connection",
    sentence: "Connected to the admin backend",
  },
  {
    id: "page-preparing",
    at: at(17, 9, 55, 27),
    tone: "warn",
    area: "Channel",
    sentence: "Fixture Sports is still preparing",
  },
];

/** How many older rows one `Load older` brings. */
export const OLDER_PAGE_SIZE = 4;

/** The drawer's starting rows, oldest first. */
export function initialEvents(): readonly EventRow<EventArea>[] {
  return [...RECENT_AUDIT.map((entry) => eventFromAudit(entry)), ...PAGE_EVENTS].sort((a, b) => a.at - b.at);
}
