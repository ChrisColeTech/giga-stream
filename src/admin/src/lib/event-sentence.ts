import type { EventRow, EventTone } from "@giga/ui/lib/event-log";
import type { AuditEntry } from "@/types/admin-audit";
import type { EventArea } from "@/types/events";

/* An audit entry as the Events drawer's row (`29` section 11): the area its action belongs to, a tone, and ONE plain
 * sentence naming the actor and the record. The sentence is built from named fields only (the actor's username, a record's
 * name, a fault, counts), so nothing else in `detail` (a password, a token, an address) can ever reach the screen. Pure;
 * `29` reuses it unchanged. */

const AREAS: Readonly<Record<string, EventArea>> = {
  auth: "Session",
  account: "Account",
  channel: "Channel",
  provider: "Provider",
  title: "Title",
  playlist: "Playlist",
  job: "Job",
  sync: "Job",
};

const VERBS: Readonly<Record<string, string>> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  rebuilt: "rebuilt",
  reverted: "reverted",
  ran: "ran",
};

const COUNTS = ["created", "updated", "removed", "refused"] as const;
const FAILURE = /fail/i;
const SYSTEM = "system";

/** What the admin knows of record ids: an id to the name it has loaded. A record it never loaded is named by its id. */
export type SubjectNames = Readonly<Record<string, string>>;

function text(detail: AuditEntry["detail"], key: string): string | undefined {
  const value = detail?.[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function count(detail: AuditEntry["detail"], key: string): number {
  const value = detail?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** An account is named by its username: the backend writes it on `account.created` and `deleted`; an `updated` entry
 *  holds only the account's name, so the held username for the subject id comes first. Only the named keys are read,
 *  never a field called `password`. */
function accountName(entry: AuditEntry, names: SubjectNames): string {
  const held = entry.subject === undefined ? undefined : names[entry.subject];
  return text(entry.detail, "username") ?? held ?? text(entry.detail, "name") ?? entry.subject ?? "";
}

/** The record's name: the entry's own (`name`, `title`, `host`), else the one the admin holds for the subject, else the id. */
function nameOf(entry: AuditEntry, names: SubjectNames): string {
  if (entry.action.startsWith("account.")) return accountName(entry, names);
  const own = text(entry.detail, "name") ?? text(entry.detail, "title") ?? text(entry.detail, "host");
  if (own !== undefined) return own;
  return entry.subject === undefined ? "" : (names[entry.subject] ?? entry.subject);
}

function importedSentence(actor: string, entry: AuditEntry): [EventTone, string] {
  const counts = COUNTS.filter((key) => count(entry.detail, key) > 0).map((key) => `${count(entry.detail, key)} ${key}`);
  const tail = counts.length === 0 ? "" : `: ${counts.join(", ")}`;
  return [count(entry.detail, "refused") > 0 ? "warn" : "info", `${actor} synced channels${tail}`];
}

function describe(entry: AuditEntry, names: SubjectNames, area: EventArea): [EventTone, string] {
  const actor = entry.actorUsername ?? SYSTEM;
  const name = nameOf(entry, names);
  switch (entry.action) {
    case "auth.login":
      return ["info", `${actor} signed in`];
    case "auth.logout":
      return ["info", `${actor} signed out`];
    case "auth.login_failed":
      return ["warn", `Sign-in failed for ${text(entry.detail, "username") ?? "an unknown username"}`];
    case "auth.password_changed":
      return ["info", `${actor} changed a password`];
    case "sync.started":
      return ["info", `${actor} started a catalog sync`];
    case "channel.fault_set":
      return ["info", `${actor} applied fault ${text(entry.detail, "fault") ?? "unknown"} to ${name}`];
    case "channel.fault_cleared":
      return ["info", `${actor} cleared the fault on ${name}`];
    case "channel.imported":
      return importedSentence(actor, entry);
    default: {
      const [, verb = ""] = entry.action.split(".");
      const word = VERBS[verb] ?? verb.replaceAll("_", " ");
      return ["info", `${actor} ${word} ${area.toLowerCase()} ${name}`.trim()];
    }
  }
}

/** The Events row for one audit entry. `names` fills in a record the entry names only by id. */
export function eventFromAudit(entry: AuditEntry, names: SubjectNames = {}): EventRow<EventArea> {
  const area = AREAS[entry.action.split(".")[0] ?? ""] ?? "Connection";
  const base = { id: `audit-${entry.id}`, at: entry.at, area };
  const outcome = text(entry.detail, "outcome");
  if (outcome !== undefined && FAILURE.test(outcome)) return { ...base, tone: "error", sentence: outcome };
  const [tone, sentence] = describe(entry, names, area);
  return { ...base, tone, sentence };
}
